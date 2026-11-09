// --- CONSTANTS ---
export const CURATOR_API_URL = 'https://cortexishere.com/curated';
export const FULL_DB_URL = 'https://cortexishere.com/models';
export const TARGET_LANGUAGES = ['tr', 'fr', 'zh'];

export const MODEL_TYPE = {
  OFFLINE: 'offline',
  ROLEPLAY: 'roleplay',
};

export const STATUS = {
  VERIFIED: 'verified',
  AUDITED_CORRECTED: 'audited_corrected',
};

// --- CHAT FORMAT TEMPLATES ---
export const CHAT_TEMPLATES = {
  // === ChatML family (Qwen, Mistral v0.3+, Gemma 3 chatml vb.) ===
  chatml: {
    template: 'chatml',
    tokens: {
      system_start: '<|im_start|>system',
      system_end: '<|im_end|>',
      user_start: '<|im_start|>user',
      user_end: '<|im_end|>',
      assistant_start: '<|im_start|>assistant',
      assistant_end: '<|im_end|>',
      stop_generation: ['<|im_end|>', '<|endoftext|>', '</s>'],
    },
  },

  // === Llama-2 / Mistrali ===
  llama2: {
    template: 'llama2',
    tokens: {
      system_start: '<<SYS>>',
      system_end: '<</SYS>>',
      user_start: '[INST]',
      user_end: '[/INST]',
      assistant_start: '',
      assistant_end: '</s>',
      stop_generation: ['</s>', '[INST]', '[/INST]'],
    },
  },

  // === Alpaca / Instruction format ===
  alpaca: {
    template: 'alpaca',
    tokens: {
      system_start: null,
      system_end: null,
      user_start: '### Instruction:\n',
      user_end: '\n',
      assistant_start: '### Response:\n',
      assistant_end: '',
      stop_generation: ['### Instruction:', '</s>'],
    },
  },

  // === Llama-3 / 3.1 (header_id + eot_id) ===
  llama3: {
    template: 'llama3',
    tokens: {
      system_start: '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n',
      system_end: '<|eot_id|>',
      user_start: '<|start_header_id|>user<|end_header_id|>\n\n',
      user_end: '<|eot_id|>',
      assistant_start: '<|start_header_id|>assistant<|end_header_id|>\n\n',
      assistant_end: '<|eot_id|>',
      stop_generation: ['<|eot_id|>', '</s>'],
    },
  },

  // === Gemma-2 (start_of_turn / end_of_turn) ===
  gemma2: {
    template: 'gemma2',
    tokens: {
      system_start: '<start_of_turn>system\n',
      system_end: '<end_of_turn>',
      user_start: '<start_of_turn>user\n',
      user_end: '<end_of_turn>',
      assistant_start: '<start_of_turn>model\n',
      assistant_end: '<end_of_turn>',
      stop_generation: ['<end_of_turn>', '</s>'],
    },
  },

  // === Anthropic-style (Human/Assistant) ===
  'anthropic-style': {
    template: 'anthropic',
    tokens: {
      system_start: 'System: ',
      system_end: '\n\n',
      user_start: '\n\nHuman: ',
      user_end: '',
      assistant_start: '\n\nAssistant: ',
      assistant_end: '',
      stop_generation: ['\n\nHuman:', '</s>'],
    },
  },

  // === Plain Dialogue (User:/Assistant:) ===
  plain_dialogue: {
    template: 'plain_dialogue',
    tokens: {
      system_start: 'System: ',
      system_end: '\n',
      user_start: 'User: ',
      user_end: '\n',
      assistant_start: 'Assistant: ',
      assistant_end: '\n',
      stop_generation: ['\nUser:', '</s>'],
    },
  },

  // === Phi-3 / GLM-vari modern rolu etiketleri ===
  'phi-3_glm': {
    template: 'phi3',
    tokens: {
      system_start: '<|system|>\n',
      system_end: '<|end|>\n',
      user_start: '<|user|>\n',
      user_end: '<|end|>\n',
      assistant_start: '<|assistant|>\n',
      assistant_end: '<|end|>\n',
      stop_generation: ['<|end|>', '</s>'],
    },
  },
};
