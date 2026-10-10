/**
 * APEX v2 — Stage B Vector Store Authority
 * 
 * Provides high-performance in-memory k-NN retrieval with pluggable adapter
 * support for hosted vector databases (Qdrant, Pinecone, pgvector).
 * 
 * Gate G3 Constraint: No hosted vector infrastructure is provisioned without owner sign-off.
 * All runtime queries execute against the optimized local in-memory index.
 */

export interface VectorDocument {
  id: string;
  canonicalId: string;
  make: string;
  model: string;
  generation: string;
  variant: string | null;
  displayName: string;
  viewpoint: string;
  vector: number[];
  provenanceId?: string;
  hasSufficientCoverage?: boolean;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number; // Cosine similarity in range [-1.0, 1.0]
}

export interface IVectorStore {
  insert(doc: VectorDocument): Promise<void>;
  insertBatch(docs: VectorDocument[]): Promise<void>;
  search(queryVector: number[], topK: number, minScore?: number): Promise<VectorSearchResult[]>;
  size(): number;
}

/**
 * Local in-memory vector index using L2-normalized cosine similarity.
 */
export class LocalVectorIndex implements IVectorStore {
  private documents: VectorDocument[] = [];

  public async insert(doc: VectorDocument): Promise<void> {
    this.documents.push(doc);
  }

  public async insertBatch(docs: VectorDocument[]): Promise<void> {
    this.documents.push(...docs);
  }

  public async search(queryVector: number[], topK: number = 5, minScore: number = -1.0): Promise<VectorSearchResult[]> {
    if (!queryVector || queryVector.length === 0 || this.documents.length === 0) {
      return [];
    }

    const scored: VectorSearchResult[] = [];
    const dim = queryVector.length;

    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!doc.vector || doc.vector.length !== dim) continue;

      let dot = 0;
      for (let d = 0; d < dim; d++) {
        dot += queryVector[d] * doc.vector[d];
      }

      if (dot >= minScore) {
        scored.push({ document: doc, score: dot });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  public size(): number {
    return this.documents.length;
  }

  public clear(): void {
    this.documents = [];
  }
}

/**
 * Adapter interface prepared for hosted vector engines (Gate G3).
 * When provisioning is approved, connects to external endpoint without changing application contract.
 */
export class HostedVectorStoreAdapter implements IVectorStore {
  private endpointUrl: string;
  private apiKey: string | null;
  private localFallback: LocalVectorIndex;

  constructor(endpointUrl: string = 'http://localhost:6333', apiKey: string | null = null) {
    this.endpointUrl = endpointUrl;
    this.apiKey = apiKey;
    this.localFallback = new LocalVectorIndex();
  }

  public async insert(doc: VectorDocument): Promise<void> {
    // Falls back to local memory index until cloud infra is provisioned
    return this.localFallback.insert(doc);
  }

  public async insertBatch(docs: VectorDocument[]): Promise<void> {
    return this.localFallback.insertBatch(docs);
  }

  public async search(queryVector: number[], topK: number = 5, minScore: number = -1.0): Promise<VectorSearchResult[]> {
    return this.localFallback.search(queryVector, topK, minScore);
  }

  public size(): number {
    return this.localFallback.size();
  }
}

export const localVectorStore = new LocalVectorIndex();
