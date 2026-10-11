import React, { useState } from 'react';
import {
  Button,
  RarityBadge,
  StatChip,
  StatGauge,
  ProgressTicks,
  Slab,
  EmptyState,
  Skeleton,
  BottomSheet,
  Header,
} from './index';
import { useToast } from './Toast';
import { Zap, Gauge, MapPin } from 'lucide-react';

export const ComponentGallery: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-void)] text-[var(--color-text)] p-4 pb-24 space-y-8 max-w-lg mx-auto">
      {/* Gallery Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)]">
        <div>
          <h2 className="font-display text-display-l text-[var(--color-text)]">
            UI Primitives Gallery
          </h2>
          <p className="text-secondary text-[var(--color-text-3)]">
            Design tokens & component audit
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* 1. Header Bar Preview */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          1. Header Shell
        </h3>
        <Header
          onOpenProfile={() => showToast('Profile clicked', 'info')}
          onOpenCitySelector={() => showToast('City selector opened', 'info')}
          onOpenNotifications={() => showToast('Notifications opened', 'info')}
          currentCity="Lucknow"
          streakDays={4}
          unreadNotificationsCount={2}
          level={3}
          levelProgressPct={65}
        />
      </section>

      {/* 2. Buttons */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          2. Buttons (Min 48px Touch Targets)
        </h3>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" onClick={() => showToast('Primary action', 'success')}>
            Primary CTA
          </Button>
          <Button variant="secondary" onClick={() => showToast('Secondary action', 'info')}>
            Secondary
          </Button>
          <Button variant="ghost" onClick={() => showToast('Ghost action', 'info')}>
            Ghost
          </Button>
          <Button variant="danger" onClick={() => showToast('Danger action', 'error')}>
            Destructive
          </Button>
          <Button variant="primary" isLoading>
            Loading
          </Button>
        </div>
      </section>

      {/* 3. Rarity Badges */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          3. Rarity Badges (Contrast Safe & Icons)
        </h3>
        <div className="flex flex-wrap gap-2">
          <RarityBadge rarity="common" />
          <RarityBadge rarity="uncommon" />
          <RarityBadge rarity="rare" />
          <RarityBadge rarity="epic" />
          <RarityBadge rarity="legendary" />
          <RarityBadge rarity="mythic" />
        </div>
      </section>

      {/* 4. Stat Chips & Mono Instruments */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          4. Stat Chips (Tabular Mono)
        </h3>
        <div className="flex flex-wrap gap-2">
          <StatChip icon={<Zap size={14} />} value="720" unit="HP" label="Power" />
          <StatChip icon={<Gauge size={14} />} value="340" unit="km/h" label="Top Speed" />
          <StatChip icon={<MapPin size={14} />} value="1.2" unit="km" label="Distance" />
        </div>
      </section>

      {/* 5. Stat Gauges */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          5. Stat Gauges (14 Ticks)
        </h3>
        <div className="space-y-3 bg-[var(--color-panel)] p-4 rounded-[var(--radius-panel)] border border-[var(--color-line)]">
          <StatGauge label="Power Output" value={720} unit="HP" percentage={72} rarity="epic" />
          <StatGauge label="Top Speed" value={340} unit="km/h" percentage={85} rarity="legendary" />
          <StatGauge label="Acceleration" value="2.9" unit="s" percentage={95} rarity="mythic" />
        </div>
      </section>

      {/* 6. Progress Ticks */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          6. Quest Progress Ticks
        </h3>
        <div className="space-y-3 bg-[var(--color-panel)] p-4 rounded-[var(--radius-panel)] border border-[var(--color-line)]">
          <ProgressTicks current={1} total={3} label="Spot 3 Coupes" />
          <ProgressTicks current={3} total={5} label="Spot 5 V8 Engines" />
          <ProgressTicks current={3} total={3} label="Daily Goal Completed" />
        </div>
      </section>

      {/* 7. Collectible Slabs */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          7. Collectible Slabs
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Slab
            rarity="rare"
            serial="APX-0824"
            imageUrl="/spot_porsche997.jpg"
            carName="911 Carrera S"
            make="Porsche"
            city="Lucknow"
            stats={{ hp: 355, topSpeed: 293 }}
          />
          <Slab
            rarity="legendary"
            serial="APX-0012"
            imageUrl="/spot_ferrari458.jpg"
            carName="458 Italia"
            make="Ferrari"
            city="Milan"
            stats={{ hp: 570, topSpeed: 325 }}
          />
        </div>
      </section>

      {/* 8. Empty State */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          8. Designed Empty State
        </h3>
        <EmptyState
          title="Nothing here yet."
          description="Your first scan lands here as a card. Rarer cars look very different."
          actionLabel="Scan your first car"
          onAction={() => showToast('Opening scanner...', 'info')}
          secondaryActionLabel="See what a Mythic looks like"
          onSecondaryAction={() => showToast('Viewing Mythic specimen', 'info')}
        />
      </section>

      {/* 9. Skeletons */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          9. GPU Shimmer Skeletons
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </section>

      {/* 10. BottomSheet & Toast Trigger */}
      <section className="space-y-3">
        <h3 className="font-display text-display-m text-[var(--color-text-2)]">
          10. BottomSheet & Toasts
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
            Open BottomSheet
          </Button>
          <Button variant="ghost" onClick={() => showToast('Test Toast Notification', 'success')}>
            Trigger Toast
          </Button>
        </div>

        <BottomSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Filter Vehicles"
        >
          <div className="space-y-4">
            <p className="text-secondary text-[var(--color-text-2)]">
              Filter your garage collection by rarity tier, make, or location.
            </p>
            <Button variant="primary" className="w-full" onClick={() => setIsSheetOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </BottomSheet>
      </section>
    </div>
  );
};

ComponentGallery.displayName = 'ComponentGallery';
