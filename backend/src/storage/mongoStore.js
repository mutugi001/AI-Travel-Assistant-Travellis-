import mongoose from "mongoose";
import { config } from "../config.js";
import { ConversationModel, LeadModel } from "../models/schemas.js";

export const mongoStore = {
  async init() {
    await mongoose.connect(config.mongodbUri);
    console.log("[storage] Connected to MongoDB");
  },

  async getConversation(conversationId) {
    const doc = await ConversationModel.findOne({ conversationId }).lean();
    return doc || null;
  },

  async saveConversation(conversationId, conversation) {
    const doc = await ConversationModel.findOneAndUpdate(
      { conversationId },
      { conversationId, ...conversation },
      { upsert: true, new: true }
    ).lean();
    return doc;
  },

  async upsertLead(conversationId, lead) {
    const doc = await LeadModel.findOneAndUpdate(
      { conversationId },
      { conversationId, ...lead },
      { upsert: true, new: true }
    ).lean();
    return doc;
  },

  async getAllLeads() {
    const docs = await LeadModel.find().sort({ updatedAt: -1 }).lean();
    return docs;
  },

  async getLead(conversationId) {
    const doc = await LeadModel.findOne({ conversationId }).lean();
    return doc || null;
  },
};
