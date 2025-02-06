const { PubSub } = require('@google-cloud/pubsub');

class PubSubService {
  constructor() {
    this.pubsub = null;
    this.projectId = null;
    this.topicName = null;
    this.initialized = false;
  }

  initialize(projectId, topicName = 'CRM-tasks') {
    if (!projectId) {
      throw new Error('Project ID is required for PubSub initialization');
    }

    this.projectId = projectId;
    this.topicName = topicName;
    this.pubsub = new PubSub({ projectId });
    this.initialized = true;
  }

  async publishToCRM(data) {
    if (!this.initialized) {
      throw new Error('PubSub service not initialized');
    }

    try {
      const topic = this.pubsub.topic(this.topicName);
      
      // Format message according to CRM service requirements
      const message = {
        crmProcess: "screenerNotification",
        customer: {
          email: data.email,
          name: null // Optional field, defaulting to null
        },
        sessionId: data.sessionId,
        metadata: {
          originalName: data.metadata.originalName,
          imageUrl: data.metadata.imageUrl,
          timestamp: Date.now(),
          analyzed: false,
          originAnalyzed: false,
          size: data.metadata.size,
          mimeType: data.metadata.mimeType
        },
        timestamp: Date.now(),
        origin: "screener"
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to ${this.topicName}`);
      
      return messageId;
    } catch (error) {
      console.error(`Error publishing to ${this.topicName}:`, error);
      throw error;
    }
  }
}

module.exports = new PubSubService();