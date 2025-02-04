const { PubSub } = require('@google-cloud/pubsub');

class PubSubService {
  constructor() {
    this.pubsub = null;
    this.projectId = null;
    this.initialized = false;
  }

  initialize(projectId) {
    if (!projectId) {
      throw new Error('Project ID is required for PubSub initialization');
    }

    this.projectId = projectId;
    this.pubsub = new PubSub({ projectId });
    this.initialized = true;
  }

  async publishToCRM(data) {
    if (!this.initialized) {
      throw new Error('PubSub service not initialized');
    }

    try {
      const topic = this.pubsub.topic('CRM-tasks');
      const messageBuffer = Buffer.from(JSON.stringify(data));
      
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to CRM-tasks`);
      
      return messageId;
    } catch (error) {
      console.error('Error publishing to CRM-tasks:', error);
      throw error;
    }
  }
}

module.exports = new PubSubService();