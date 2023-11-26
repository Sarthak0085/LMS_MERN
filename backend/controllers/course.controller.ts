import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/Errorhandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "path";
import ejs from "ejs";
import sendEmail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";

// create course
export const uploadCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { data } = req.body;
        const thumbnail = data.thumbnail;

        if (thumbnail) {
            const myCloud = cloudinary.v2.uploader.upload(thumbnail, {
                folder: "Courses"
            });

            data.thumbnail = {
                public_id: (await myCloud).public_id,
                url: (await myCloud).secure_url
            }
        }

        createCourse(data, res, next);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});


//edit course
export const editCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        const courseId = req.params.id;

        const courseData = await CourseModel.findById(courseId) as any;

        if (thumbnail && !thumbnail.startsWith('https')) {
            await cloudinary.v2.uploader.destroy(thumbnail.public_id);

            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "Courses",
            });

            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            };
        }

        if (thumbnail.startsWith('https')) {
            data.thumbnail = {
                public_id: courseData?.thumbnail?.public_id,
                url: courseData?.thumbnail?.url,
            };
        }

        // const courseId = req.params.id;

        const course = await CourseModel.findByIdAndUpdate(courseId, {
            $set: data,
        }, {
            new: true,
        })

        res.status(201).json({
            success: true,
            course,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));

    }
});

//get single course -- without purchasing
export const getSingleCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = req.params.id;

        const isCachedExist = await redis.get(courseId);

        if (isCachedExist) {
            const course = JSON.parse(isCachedExist);
            res.status(200).json({
                success: true,
                course
            })
        }
        else {
            const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.links -courseData.suggestions -courseData.questions");

            await redis.set(courseId, JSON.stringify(course), "EX", 604800);

            res.status(200).json({
                success: true,
                course
            })
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

//get all courses -- without purchasing
export const getAllCourses = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isCachedExist = await redis.get("AllCourses");
        if (isCachedExist) {
            const courses = JSON.parse(isCachedExist);
            res.status(200).json({
                success: true,
                courses
            })
        }
        else {
            const courses = await CourseModel.find({}).select("-courseData.videoUrl -courseData.links -courseData.suggestions -courseData.questions");

            redis.set("AllCourses", JSON.stringify(courses));

            res.status(200).json({
                success: true,
                courses
            })
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

//get course --- only for valid user
export const getCourseByUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userCourses = req.user?.courses;
        const courseId = req.params.id;

        const courseExists = userCourses?.find((course: any) => course._id.toString() === courseId);

        if (!courseExists) {
            return next(new ErrorHandler("You are not eligible to access this course", 400));
        }

        const course = await CourseModel.findById(courseId);

        const content = course?.courseData;

        res.status(200).json({
            success: true,
            content
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

interface IAddQuestion {
    question: string;
    courseId: string;
    contentId: string;
}

// add question
export const addQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { question, courseId, contentId } = req.body as IAddQuestion;

        const course = await CourseModel.findById(courseId);

        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid Content Id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if (!courseContent) {
            return next(new ErrorHandler("Invalid Content Id", 400));
        }

        // create a new question
        const newQuestion = {
            user: req.user,
            question,
            questionReplies: []
        } as any;

        // add question to our course content
        courseContent.questions.push(newQuestion);

        await NotificationModel.create({
            user: req.user?._id,
            title: "New Question Received",
            message: `You have a new Question in ${courseContent.title}`
        });

        // save the updated course
        await course?.save();

        res.status(200).json({
            success: true,
            course
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// add answer to the question
interface IAddAnswer {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
}

export const addAnswer = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { answer, questionId, courseId, contentId } = req.body as IAddAnswer;

        const course = await CourseModel.findById(courseId);

        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid Content Id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if (!courseContent) {
            return next(new ErrorHandler("Invalid Content Id", 400));
        }

        const question = courseContent?.questions.find((item: any) => item._id.equals(questionId));

        if (!question) {
            return next(new ErrorHandler("Inavlid question id", 400));
        }

        // create a new question
        const newAnswer = {
            user: req.user,
            answer,
        } as any;

        // push answer to the question
        question?.questionReplies?.push(newAnswer);

        // save the updated course
        await course?.save();

        if (req.user?._id === question?.user?._id) {
            // create a notification
            await NotificationModel.create({
                user: req.user?._id,
                title: "New Question Reply Received",
                message: `You have a new Question Reply in ${courseContent.title}`
            });
        } else {
            const data = {
                name: question.user.name,
                title: courseContent.title,
            }

            const html = await ejs.renderFile(path.join(__dirname, "../mails/questionReply.ejs"), data);

            try {
                await sendEmail({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "questionReply.ejs",
                    data
                });
            } catch (error: any) {
                return next(new ErrorHandler(error.message, 500));
            }

        }

        res.status(200).json({
            success: true,
            course
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// add review in course
interface IAddReviewData {
    review: string;
    courseId: string;
    rating: number;
    userId: string;
}

export const addReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userCourses = req.user?.courses;

        const courseId = req.params.id;

        //check if courseId already exist in userCourses
        const courseExists = userCourses?.some((course: any) => course._id.toString() === courseId.toString());

        if (!courseExists) {
            return next(new ErrorHandler("You are not eligible to access this course", 400));
        }

        const course = await CourseModel.findById(courseId);

        const { review, rating } = req.body as IAddReviewData;

        const reviewData: any = {
            user: req.user,
            comment: review,
            rating
        }

        course?.reviews.push(reviewData);

        let avg = 0;

        course?.reviews.forEach((rev: any) => {
            avg += rev.rating;
        });

        if (course) {
            course.ratings = avg / course?.reviews.length;
        }

        await course?.save();

        const notification = {
            title: "New Review Received",
            message: `${req.user?.name} has given a review on ${course?.name}`
        }

        // create notification
        await NotificationModel.create({
            user: req.user?._id,
            title: "New Review Received",
            message: `You have a new Review on ${course?.name}`
        });

        res.status(200).json({
            success: true,
            course
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});


// add reply in review
interface IAddReplyToReviewData {
    comment: string,
    reviewId: string,
    courseId: string
}

export const addReplyToReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { comment, reviewId, courseId } = req.body as IAddReplyToReviewData;

        const course = await CourseModel.findById(courseId);

        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        const review = course?.reviews.find((rev: any) => rev._id.toString() === reviewId);

        if (!review) {
            return next(new ErrorHandler("Review not found", 404));
        }

        const replyData: any = {
            user: req.user,
            comment
        }

        if (!review.commentReplies) {
            review.commentReplies = [];
        }

        review?.commentReplies.push(replyData);

        await course?.save();

        res.status(200).json({
            success: true,
            course
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// get all courses -- only admin
export const getAllCoursesByAdmin = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllCoursesService(res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// delete course -- only for admin
export const deleteCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const course = await CourseModel.findById(id);

        if (!course) {
            return next(new ErrorHandler("Course Not Found", 404));
        }

        await course.deleteOne({ id });

        await redis.del(id);

        res.status(201).json({
            success: true,
            message: "Course deleted successfully"
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

//generate video url
export const generateVideoUrl = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { videoId } = req.body;
        const response = await axios.post(`https://dev.vdocipher.com/api/videos/${videoId}/otp`,
            { ttl: 300 },
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `ApiSecret ${process.env.VDO_SECRET}`
                }
            })
        res.json(response.data);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})