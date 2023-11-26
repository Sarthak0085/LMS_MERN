import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const dbUrl: string = process.env.DB_URL || "";

const connectDB = async () => {
    try {
        await mongoose.connect(dbUrl).then((data: any) => {
            console.log(`Database is connected with ${data.connection.host}`);

        })
    } catch (error: any) {
        console.log(error);
        setTimeout(connectDB, 5000);

    }
}

export default connectDB;
