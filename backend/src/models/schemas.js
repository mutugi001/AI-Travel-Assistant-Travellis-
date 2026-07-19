import mongoose from "mongoose";

const { Schema } = mongoose;

const ConversationSchema = new Schema(
  {
    conversationId: { type: String, unique: true, index: true },
    messages: [{ role: String, content: String }],
    fields: { type: Schema.Types.Mixed, default: {} },
    intentLevel: String,
    contactRequested: Boolean,
    contactDeclined: Boolean,
  },
  { timestamps: true }
);

const LeadSchema = new Schema(
  {
    conversationId: { type: String, unique: true, index: true },
    customer: {
      name: String,
      phone: String,
      email: String,
    },
    travel: {
      destination: String,
      departureCity: String,
      travelDate: String,
      travellers: Number,
      budget: String,
      duration: String,
      tripType: String,
      specialRequirements: String,
    },
    qualification: {
      leadScore: Number,
      confidence: String,
      reason: String,
      summary: String,
    },
    status: String, // e.g. "qualified", "interested_no_contact", "contact_only"
  },
  { timestamps: true }
);

export const ConversationModel =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
export const LeadModel = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
