export interface AIAgentRequest {
  question: string;
  api_key?: string;
  model_name?: string;
}

export interface AIAgentResponse {
  answer: string;
  confidence: number;
  clarified_query: string;
  customer_type: string;
  key_information: string;
  main_topic: string;
  question: string;
}

export interface IAIAgentService {
  analyzeMessage(request: AIAgentRequest): Promise<AIAgentResponse>;
}
