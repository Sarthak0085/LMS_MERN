import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/Errorhandler";
import { IOrder } from "../models/order.model";
import UserModel from "../models/user.model";
import CourseModel from "../models/course.model";
import { getAllOrdersService, newOrder } from "../services/order.service";
import path from "path";
import ejs from "ejs";
import sendEmail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { redis } from "../utils/redis";
require('dotenv');
const stripe = require('stripe')(process.env.STRIPE_SECRET)

// create order 
export const createOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, payment_info } = req.body as IOrder;

        if (payment_info) {
            if ("id" in payment_info) {
                const paymentIntentId = payment_info.id;
                const paymentIntent = await stripe.paymentIntents.retrieve(
                    paymentIntentId
                );

                if (paymentIntent.status !== "succeeded") {
                    return next(new ErrorHandler("Payment Not Authorized", 400));
                }
            }

        }

        const user = await UserModel.findById(req?.user?._id);

        const courseExistsInUserInfo = user?.courses.some((course: any) => course._id.toString() === courseId);

        if (courseExistsInUserInfo) {
            return next(new ErrorHandler("You have already purchased this course", 400));
        }

        const course = await CourseModel.findById(courseId);

        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        const data: any = {
            courseId,
            userId: user?._id,
        }

        // const mailData = {
        //     order: {
        //         _id: course?._id.toString().slice(0, 6),
        //         name: course.name,
        //         price: course.price,
        //         date: new Date().toLocaleDateString('en-US', { year: "numeric", month: "long", day: "numeric" }),
        //     }
        // }

        // const html = await ejs.renderFile(path.join(__dirname, "../mails/questionReply.ejs"), { order: mailData });

        // try {
        //     if (user) {
        //         await sendEmail({
        //             email: user.email,
        //             subject: "Order Confirmation",
        //             template: "questionReply.ejs",
        //             data: mailData,
        //         });
        //     }
        // } catch (error: any) {
        //     return next(new ErrorHandler(error.message, 500));
        // }

        user?.courses.push(course?._id);

        await redis.set(req.user?._id, JSON.stringify(user));

        await user?.save();

        await NotificationModel.create({
            user: user?._id,
            title: "New Order",
            message: `You have a new Order from ${course?.name}`
        });

        res.status(201).json({
            success: true,
            order: course,
        });

        course.purchased ? course.purchased += 1 : course.purchased;

        await course?.save();

        newOrder(data, res, next);

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// get all orders -- only admin
export const getAllOrders = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllOrdersService(res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

//send stripe publishable key
export const sendStripePublishableKey = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    res.status(201).json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    })
});

//new payment
export const newPayment = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const myPayment = await stripe.paymentIntents.create({
            amount: req.body.amount,
            currency: "USD",
            metadata: {
                company: "E-Learning",
            },
            automatic_payment_methods: {
                enabled: true,
            }
        });

        res.status(201).json({
            success: true,
            client_secret: myPayment.client_secret,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})