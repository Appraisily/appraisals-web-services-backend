/**
 * OpenAI model configuration
 * Centralized configuration for OpenAI models to make updates easier
 */

const OPENAI_MODELS = {
  // Models for different analysis types
  VISUAL_SEARCH: 'gpt-4o',
  ORIGIN: 'o1',
  
  // Default model if type is not specified
  DEFAULT: 'gpt-4o'
};

module.exports = {
  OPENAI_MODELS,
  
  // Helper function to get model by type
  getModel: (type) => OPENAI_MODELS[type] || OPENAI_MODELS.DEFAULT
};