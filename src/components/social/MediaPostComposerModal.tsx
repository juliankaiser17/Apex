import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Camera as CameraIcon, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useApexStore } from '../../store/useApexStore';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../utils/audio';
import type { FeedPost } from '../../types/apex';

interface MediaPostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MediaPostComposerModal: React.FC<MediaPostComposerModalProps> = ({
  isOpen,
  onClose
}) => {
  const user = useApexStore(s => s.user);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const resetState = (preserveBlob = false) => {
    isSubmittingRef.current = false;
    setSelectedFile(null);
    if (!preserveBlob && previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setThumbnailDataUrl(null);
    setCaption('');
    setIsUploading(false);
    setUploadProgress(0);
    setErrorMessage(null);
  };

  const handleClose = (preserveBlob: boolean | React.MouseEvent = false) => {
    if (isUploading) return;
    resetState(preserveBlob === true);
    onClose();
  };

  // ─── 1. EXTRACT VIDEO POSTER FRAME VIA CANVAS ───
  const extractVideoThumbnail = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const targetWidth = Math.min(720, video.videoWidth || 640);
          const targetHeight = Math.round((targetWidth / (video.videoWidth || 640)) * (video.videoHeight || 360));
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Could not extract video thumbnail:', e);
        }
        URL.revokeObjectURL(objectUrl);
        resolve('');
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve('');
      };
    });
  }, []);

  // ─── 2. HANDLE FILE SELECTION (IMAGE / VIDEO) ───
  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name);

    if (!isVideo && !isImage) {
      setErrorMessage('Unsupported file format. Please choose an image (JPEG, PNG, WebP) or video (MP4, MOV, WebM).');
      return;
    }

    // Size limit: 50MB for video, 15MB for photo
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is ${isVideo ? '50MB for videos' : '15MB for images'}.`);
      return;
    }

    const type = isVideo ? 'video' : 'image';
    setMediaType(type);
    setSelectedFile(file);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    if (isVideo) {
      const thumb = await extractVideoThumbnail(file);
      setThumbnailDataUrl(thumb || null);
    } else {
      setThumbnailDataUrl(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // ─── 3. CAPACITOR CAMERA FOR DIRECT PHOTO SHOOT ───
  const handleTakeCameraPhoto = async () => {
    try {
      sounds.playShutter();
      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (photo.dataUrl) {
        // Convert DataUrl to File
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `apex_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        processSelectedFile(file);
      }
    } catch (err) {
      console.warn('Camera capture cancelled or failed:', err);
    }
  };

  // ─── 4. SUBMIT MEDIA POST & ASYNC STORAGE UPLOAD ───
  const handleSubmitPost = async () => {
    if (!selectedFile || isUploading || isSubmittingRef.current) return;
    if (!user.id) {
      setErrorMessage('Please sign in to post media.');
      return;
    }

    isSubmittingRef.current = true;
    setIsUploading(true);
    setUploadProgress(15);
    setErrorMessage(null);
    sounds.playTargetLock();

    try {
      const isUuidUser = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      let publicUrl = previewUrl || '';
      let finalThumbUrl = thumbnailDataUrl || previewUrl || '';
      let newPostId = `post-${Date.now()}`;

      const { data: authSession } = await supabase.auth.getSession();
      const hasActiveSession = !!(authSession?.session?.user && authSession.session.user.id === user.id);

      if (isUuidUser && hasActiveSession) {
        try {
          const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const uniqueFileName = `${Date.now()}_${cleanFileName}`;
          const filePath = `${user.id}/${uniqueFileName}`;

          setUploadProgress(35);

          // Upload main media file to Supabase Storage 'social-media'
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('social-media')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadErr) {
            console.warn('Supabase storage upload error, continuing with local preview:', uploadErr.message);
          } else if (uploadData?.path) {
            publicUrl = supabase.storage
              .from('social-media')
              .getPublicUrl(uploadData.path).data.publicUrl;
            finalThumbUrl = publicUrl;

            // If video and thumbnail frame exists, upload thumbnail image too
            if (mediaType === 'video' && thumbnailDataUrl) {
              try {
                const thumbBlob = await (await fetch(thumbnailDataUrl)).blob();
                const thumbPath = `${user.id}/${Date.now()}_thumb.jpg`;
                const { data: thumbUpload } = await supabase.storage
                  .from('social-media')
                  .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' });
                if (thumbUpload?.path) {
                  finalThumbUrl = supabase.storage.from('social-media').getPublicUrl(thumbUpload.path).data.publicUrl;
                }
              } catch (e) {
                console.warn('Thumbnail upload skipped:', e);
              }
            }
          }

          setUploadProgress(70);

          // Insert record into Supabase posts table
          const { data: newPostData, error: insertErr } = await supabase
            .from('posts')
            .insert([{
              user_id: user.id,
              car_id: null,
              caption: caption.trim() || null,
              media_type: mediaType,
              media_url: publicUrl,
              thumbnail_url: finalThumbUrl,
              likes_count: 0,
              comments_count: 0
            }])
            .select(`
              id, caption, likes_count, comments_count, created_at, media_type, media_url, thumbnail_url,
              profiles ( id, username, avatar_url, level )
            `)
            .single();

          if (!insertErr && newPostData?.id) {
            newPostId = newPostData.id;
          }
        } catch (cloudErr) {
          console.warn('Cloud sync skipped, saving post to local feed:', cloudErr);
        }
      }

      setUploadProgress(100);
      sounds.playXpPop();

      // Construct FeedPost for local state update
      const newFeedPost: FeedPost = {
        id: newPostId,
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          level: user.level || 1
        },
        mediaType,
        mediaUrl: publicUrl,
        thumbnailUrl: finalThumbUrl,
        caption: caption.trim() || undefined,
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
        createdAt: 'Just now',
        comments: []
      };

      // Prepend to active feed
      const currentPosts = useApexStore.getState().feedPosts;
      useApexStore.setState({ feedPosts: [newFeedPost, ...currentPosts] });

      try {
        localStorage.setItem('apex_user_posts', JSON.stringify([newFeedPost, ...currentPosts]));
      } catch (e) {}

      handleClose(true);
    } catch (err: any) {
      console.error('Error posting media:', err);
      isSubmittingRef.current = false;
      setErrorMessage(err.message || 'An unexpected error occurred during upload. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none font-sans"
      >
        {/* Backdrop dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-[#111111] border border-white/15 rounded-t-[28px] sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
          style={{
            paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))'
          }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#141414]">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10"
                style={{ backgroundColor: 'rgba(229,9,20,0.15)' }}
              >
                <Sparkles className="w-4 h-4 text-[#E50914]" />
              </div>
              <h3 className="font-display text-base font-bold text-white tracking-wide">
                NEW APEX DISCOVERY
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={isUploading}
              aria-label="Close composer"
              className="w-10 h-10 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Hidden HTML File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
            {/* Error Message Toast */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Media Selector or Preview Area */}
            {!previewUrl ? (
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-56 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#E50914] bg-[#161616] flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-[#E50914]/20 border border-white/10 group-hover:border-[#E50914] flex items-center justify-center text-white/70 group-hover:text-[#E50914] transition-all mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-white mb-1">Choose Photo or Video</h4>
                  <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                    Select a car photograph, rolling shot, or video edit from your device
                  </p>
                  <span className="text-[10px] text-white/30 font-mono mt-3">
                    MP4, MOV, WebM (up to 50MB) · JPEG, PNG (up to 15MB)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-4 rounded-xl bg-[#1c1c1c] border border-white/10 hover:border-white/25 active:scale-95 flex items-center justify-center gap-2 text-xs font-semibold text-white/90 transition-all"
                  >
                    <ImageIcon className="w-4 h-4 text-[#E50914]" />
                    <span>Media Library</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTakeCameraPhoto}
                    className="py-3 px-4 rounded-xl bg-[#1c1c1c] border border-white/10 hover:border-white/25 active:scale-95 flex items-center justify-center gap-2 text-xs font-semibold text-white/90 transition-all"
                  >
                    <CameraIcon className="w-4 h-4 text-[#E50914]" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Media Preview Player/Canvas */}
                <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-black border border-white/20 shadow-inner flex items-center justify-center">
                  {mediaType === 'video' ? (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Upload Preview"
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Change Media Button */}
                  {!isUploading && (
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setThumbnailDataUrl(null);
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 text-xs font-bold text-white hover:bg-black/90 active:scale-90 transition-all"
                    >
                      Change
                    </button>
                  )}

                  {/* Media Type Badge */}
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/20 flex items-center gap-1.5 text-[10px] font-bold text-white">
                    {mediaType === 'video' ? (
                      <>
                        <VideoIcon className="w-3 h-3 text-[#E50914]" />
                        <span>VIDEO POST</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3 h-3 text-[#E50914]" />
                        <span>PHOTO POST</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Caption Input */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Caption (optional)
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Tell other spotters about this car, mods, or location..."
                    rows={3}
                    maxLength={300}
                    disabled={isUploading}
                    className="w-full bg-[#181818] border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all resize-none"
                  />
                  <div className="flex justify-between items-center text-[10px] text-white/40 mt-1">
                    <span>Direct community feed post</span>
                    <span>{caption.length}/300</span>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {isUploading && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E50914] animate-ping" />
                        Uploading to Apex Feed...
                      </span>
                      <span className="text-[#E50914] font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-[#E50914]"
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          {previewUrl && (
            <div className="p-4 border-t border-white/10 bg-[#141414] flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="flex-1 py-3 px-4 rounded-xl border border-white/15 text-xs font-bold text-white/70 hover:text-white active:scale-95 transition-all min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPost}
                disabled={isUploading || !selectedFile}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white active:scale-95 transition-all min-h-[44px] ${
                  isUploading || !selectedFile
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-[#E50914] hover:bg-[#DC2626] shadow-lg shadow-red-950/60'
                }`}
              >
                {isUploading ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>Publishing ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post to Feed</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
