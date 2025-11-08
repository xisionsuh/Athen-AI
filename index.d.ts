/**
 * Athena AI - TypeScript Type Definitions
 * Multi-AI collaborative system with brain-like architecture
 */

/**
 * Athena AI Configuration
 */
export interface AthenaConfig {
  /** Database file path */
  dbPath?: string;
  
  /** OpenAI API Key */
  openaiApiKey?: string;
  
  /** Google Gemini API Key */
  geminiApiKey?: string;
  
  /** Anthropic Claude API Key */
  claudeApiKey?: string;
  
  /** xAI Grok API Key */
  grokApiKey?: string;
  
  /** Enable web search functionality */
  webSearchEnabled?: boolean;
  
  /** Google Custom Search API Key */
  searchApiKey?: string;
  
  /** Google Custom Search Engine ID */
  searchEngineId?: string;
  
  /** MCP (Model Context Protocol) enabled */
  mcpEnabled?: boolean;
  
  /** MCP workspace root directory */
  mcpWorkspaceRoot?: string;
  
  /** Plugins enabled */
  pluginsEnabled?: boolean;
  
  /** Plugins directory path */
  pluginsDir?: string;
  
  /** WebSearchService instance (optional) */
  webSearchService?: any;
}

/**
 * AI Provider Status
 */
export interface AIProviderStatus {
  name: string;
  isAvailable: boolean;
  lastError: string | null;
}

/**
 * AI Provider Interface
 */
export interface AIProvider {
  name: string;
  apiKey: string;
  config: Record<string, any>;
  isAvailable: boolean;
  lastError: string | null;
  
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk>;
  checkHealth(): Promise<boolean>;
  getStatus(): AIProviderStatus;
}

/**
 * Chat Message
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat Options
 */
export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  imageData?: ImageData[];
  [key: string]: any;
}

/**
 * Image Data for Vision API
 */
export interface ImageData {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

/**
 * Chat Response
 */
export interface ChatResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

/**
 * Chat Chunk (for streaming)
 */
export interface ChatChunk {
  content: string;
  done?: boolean;
}

/**
 * Process Options
 */
export interface ProcessOptions {
  searchResults?: SearchResult[] | null;
  imageData?: ImageData[];
}

/**
 * Process Response
 */
export interface ProcessResponse {
  content: string;
  metadata?: ProcessMetadata;
}

/**
 * Process Metadata
 */
export interface ProcessMetadata {
  strategy?: string;
  agentsUsed?: string[];
  searchResults?: SearchResult[];
  collaborationMode?: string;
  reasoning?: string;
  [key: string]: any;
}

/**
 * Search Result
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  relevanceScore?: number;
  reliabilityScore?: number;
}

/**
 * Search Options
 */
export interface SearchOptions {
  num?: number;
  safe?: 'active' | 'off';
  [key: string]: any;
}

/**
 * Memory Entry
 */
export interface MemoryEntry {
  id?: number;
  userId: string;
  sessionId?: string;
  category?: string;
  title?: string;
  content: string;
  tags?: string[];
  importance?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Session
 */
export interface Session {
  id: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * Performance Statistics
 */
export interface PerformanceStats {
  provider: string;
  taskType: string;
  successRate: number;
  avgResponseTime: number;
  totalUses: number;
  userSatisfaction: number;
  lastUpdated: string;
}

/**
 * Performance Alert
 */
export interface PerformanceAlert {
  type: 'slow_response' | 'low_success_rate' | 'low_satisfaction';
  severity: 'high' | 'medium';
  provider: string;
  taskType: string;
  message: string;
  value: number;
  threshold: number;
}

/**
 * Performance History Entry
 */
export interface PerformanceHistoryEntry {
  provider: string;
  taskType: string;
  timestamp: string;
  avgResponseTime: number;
  avgSuccessRate: number;
  totalCalls: number;
}

/**
 * API Usage Statistics
 */
export interface APIUsageStats {
  provider: string;
  model: string;
  taskType: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  totalCalls: number;
  successfulCalls: number;
  successRate: number;
}

/**
 * Learning Pattern
 */
export interface LearningPattern {
  date: string;
  decisionType: string;
  process: Record<string, any>;
  aiUsed: string[];
}

/**
 * AI Selection Pattern
 */
export interface AISelectionPattern {
  aiSelectionCount: Record<string, number>;
  categoryPattern: Record<string, Record<string, number>>;
  modePattern: Record<string, Record<string, number>>;
  totalDecisions: number;
}

/**
 * Satisfaction Trend Entry
 */
export interface SatisfactionTrendEntry {
  date: string;
  satisfaction: number;
  count: number;
}

/**
 * Strategy Heatmap Data
 */
export interface StrategyHeatmapData {
  heatmapData: Record<string, number>;
  categories: string[];
  modes: string[];
  total: number;
}

/**
 * Athena AI Main Class
 */
export declare class AthenaAI {
  constructor(config: AthenaConfig);
  
  /** Memory manager instance */
  readonly memory: MemoryManager;
  
  /** Performance monitor instance */
  readonly performance: PerformanceMonitor;
  
  /** Web search service instance (if enabled) */
  readonly webSearch?: WebSearchService;
  
  /**
   * Process a message
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param message - User message
   * @param options - Process options
   * @returns Process response
   */
  process(userId: string, sessionId: string, message: string, options?: ProcessOptions): Promise<ProcessResponse>;
  
  /**
   * Process a message with streaming
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param message - User message
   * @param options - Process options
   * @returns Async generator of chat chunks
   */
  processStream(userId: string, sessionId: string, message: string, options?: ProcessOptions): AsyncGenerator<ChatChunk>;
  
  /**
   * Search the web
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

/**
 * Memory Manager Interface
 */
export interface MemoryManager {
  /**
   * Add short-term memory
   */
  addShortTermMemory(userId: string, sessionId: string, messageType: 'user' | 'assistant', content: string, metadata?: Record<string, any>): any;
  
  /**
   * Get short-term memory
   */
  getShortTermMemory(sessionId: string, limit?: number): Message[];
  
  /**
   * Add long-term memory
   */
  addLongTermMemory(userId: string, category: string, title: string, content: string, tags?: string[], importance?: number): any;
  
  /**
   * Get long-term memory
   */
  getLongTermMemory(userId: string, category?: string): MemoryEntry[];
  
  /**
   * Search long-term memory
   */
  searchLongTermMemory(userId: string, query: string, limit?: number): MemoryEntry[];
  
  /**
   * Create session
   */
  createSession(userId: string, title?: string): Session;
  
  /**
   * Get session
   */
  getSession(sessionId: string): Session | null;
  
  /**
   * Get user sessions
   */
  getUserSessions(userId: string): Session[];
  
  /**
   * Delete session
   */
  deleteSession(sessionId: string): void;
  
  /**
   * Log decision
   */
  logDecision(userId: string, sessionId: string, decisionType: string, input: string, process: Record<string, any>, output: string, aiUsed: string[]): any;
  
  /**
   * Get decision log
   */
  getDecisionLog(sessionId: string, limit?: number): any[];
  
  /**
   * Get learning patterns
   */
  getLearningPatterns(userId: string, days?: number): LearningPattern[];
  
  /**
   * Get AI selection patterns
   */
  getAISelectionPatterns(userId: string, days?: number): AISelectionPattern;
  
  /**
   * Get satisfaction trend
   */
  getSatisfactionTrend(userId: string, days?: number): SatisfactionTrendEntry[];
  
  /**
   * Get strategy heatmap data
   */
  getStrategyHeatmapData(userId: string, days?: number): StrategyHeatmapData;
}

/**
 * Performance Monitor Interface
 */
export interface PerformanceMonitor {
  /**
   * Start tracking
   */
  startTracking(providerName: string, taskType: string): any;
  
  /**
   * Record success
   */
  recordSuccess(tracking: any, responseTime?: number, usage?: any, model?: string): void;
  
  /**
   * Record failure
   */
  recordFailure(tracking: any, error?: Error, model?: string): void;
  
  /**
   * Get performance stats
   */
  getPerformanceStats(providerName?: string, taskType?: string): PerformanceStats[];
  
  /**
   * Get best provider for task
   */
  getBestProviderForTask(taskType: string): PerformanceStats | null;
  
  /**
   * Get summary
   */
  getSummary(): PerformanceStats[];
  
  /**
   * Check performance alerts
   */
  checkPerformanceAlerts(providerName?: string, taskType?: string): PerformanceAlert[];
  
  /**
   * Get performance history
   */
  getPerformanceHistory(providerName?: string, taskType?: string, hours?: number): PerformanceHistoryEntry[];
  
  /**
   * Get provider comparison
   */
  getProviderComparison(taskType?: string, limit?: number): PerformanceStats[];
  
  /**
   * Get API usage stats
   */
  getAPIUsageStats(startDate?: string, endDate?: string, providerName?: string): APIUsageStats[];
}

/**
 * Web Search Service Interface
 */
export interface WebSearchService {
  /**
   * Search the web
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Get relevance score
   */
  getRelevanceScore(result: SearchResult, query: string): number;
  
  /**
   * Summarize search results
   */
  summarizeSearchResults(query: string, results: SearchResult[], orchestrator?: any): Promise<string>;
}

/**
 * Factory function to create Athena AI instance
 */
export declare function createAthena(config: AthenaConfig): AthenaAI;

/**
 * Default export
 */
export default AthenaAI;

