import mongoose, { Document, Model, Schema } from "mongoose";


export interface INotifaction extends Document {
    title: string,
    message: string,
    status: string,
    userId: string,
}

const notificationSchema = new Schema<INotifaction>({
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ["UNREAD", "READ"],
        default: "UNREAD"
    },
}, { timestamps: true });

const NotificationModel: Model<INotifaction> = mongoose.model("Notification", notificationSchema);

export default NotificationModel