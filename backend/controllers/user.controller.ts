import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import UserModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/Errorhandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendEmail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import cloudinary from "cloudinary";

dotenv.config();

// register user
interface IRegistrationbody {
    name: string,
    email: string,
    password: string,
    avatar?: string,
}

export const registerUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;
        const isEmailExist = await UserModel.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler("Email already exist", 400));
        }
        const user: IRegistrationbody = {
            name,
            email,
            password
        }

        const activationToken = createActivationToken(user);

        const activationCode = activationToken.activationCode;

        const data = { user: { name: user.name }, activationCode };

        const html = await ejs.renderFile(path.join(__dirname, "../mails/activationMail.ejs"), data);

        try {
            await sendEmail({
                email: user.email,
                subject: "Activate your account",
                template: "activationMail.ejs",
                data
            });


            res.status(201).json({
                success: true,
                message: `Please check your email: ${user.email} to activate your account.`,
                activationToken: activationToken.token
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IActivationToken {
    token: string,
    activationCode: string,
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({
        user, activationCode
    }, process.env.ACTIVATION_SECRET as Secret, {
        expiresIn: "5m"
    })

    return { activationCode, token };
}

interface IActivationRequest {
    activation_token: string,
    activation_code: string,
}

export const activateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activation_token, activation_code } = req.body as IActivationRequest;
        const newUser: { user: IUser; activationCode: string } = jwt.verify(
            activation_token,
            process.env.ACTIVATION_SECRET as string,
        ) as { user: IUser; activationCode: string };

        if (newUser.activationCode !== activation_code) {
            return next(new ErrorHandler('Invalid Activation Code', 400));
        }
        const { name, email, password } = newUser.user;
        const existUser = await UserModel.findOne({ email });

        if (existUser) {
            return next(new ErrorHandler("Email Already Exist", 400));
        }

        const user = await UserModel.create({
            name,
            email,
            password,
        });

        res.status(200).json({
            success: true,
            user,
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


interface ILoginRequest {
    email: string,
    password: string,
}

// login user
export const loginUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginRequest;

        if (!email || !password) {
            return next(new ErrorHandler("Please provide your email and password", 400));
        }

        const user = await UserModel.findOne({ email }).select("+password");

        if (!user) {
            return next(new ErrorHandler("Inalid email or password", 400));
        }

        const isPasswordMatched = await user.comparePassword(password);

        if (!isPasswordMatched) {
            return next(new ErrorHandler("Inalid email or password", 400));
        }

        sendToken(user, 200, res);

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


//logout user
export const logoutUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
        const userId = req.user?._id || '';
        redis.del(userId);

        res.status(200).json({
            success: true,
            message: "Logout Successfully"
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})

// update access token
export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refresh_token as string;
        const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

        if (!decoded) {
            return next(new ErrorHandler("Could not refresh token", 400));
        }

        const session = await redis.get(decoded.id as string);

        if (!session) {
            return next(new ErrorHandler("Please login to access this resource!", 400));
        }

        const user = JSON.parse(session);
        req.user = user;

        const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, { expiresIn: "5m" });

        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, { expiresIn: "3d" });

        res.cookie("access_token", accessToken, accessTokenOptions);
        res.cookie("refresh_token", refreshToken, refreshTokenOptions);

        await redis.set(user._id, JSON.stringify(user), "EX", 604800); //expire after 7 days

        // res.status(200).json({
        //     message: "Successfully"
        // })
        next();

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// get user info
export const getUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        getUserById(userId, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})


interface ISocialAuth {
    email: string,
    name: string,
    avatar: string,
}

//social auth
export const socialAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, avatar } = req.body as ISocialAuth;
        const user = await UserModel.findOne({ email });

        if (!user) {
            const newUser = await UserModel.create({ email, name, avatar });
            sendToken(newUser, 200, res);
        }
        else {
            sendToken(user, 200, res);
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IUpdateUser {
    name: string,
    email: string,
}

// update user info
export const updateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email } = req.body as IUpdateUser;
        const userId = req.user?._id;
        const user = await UserModel.findById(userId);

        if (!user) {
            return next(new ErrorHandler("User not found", 400));
        }

        user.email = email || user.email;
        user.name = name || user.name;

        await user?.save();

        await redis.set(userId, JSON.stringify(user));

        res.status(201).json({
            success: true,
            user
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


interface IUpdatePassword {
    oldPassword: string,
    newPassword: string,
}

export const updatePassword = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = req.body as IUpdatePassword;
        const user = await UserModel.findById(req.user?._id).select("+password");

        if (!oldPassword || !newPassword) {
            return next(new ErrorHandler("Please enter old and new password", 400));
        }

        if (user?.password === undefined) {
            return next(new ErrorHandler("Invalid user", 400));
        }

        const isMatched = await user?.comparePassword(oldPassword);

        if (!isMatched) {
            return next(new ErrorHandler("Invalid old password", 400));
        }

        user.password = newPassword || user?.password;

        await user?.save();

        await redis.set(req.user?._id, JSON.stringify(user));

        res.status(201).json({
            success: true,
            message: "Password updated successfully"
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IupdateProfile {
    avatar: string
}

export const updateUserAvatar = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { avatar } = req.body as IupdateProfile;
        const userId = req.user?._id;

        const user = await UserModel.findById(userId);

        if (avatar === null) {
            return next(new ErrorHandler("Avatar not found", 400));
        }

        if (avatar && user) {
            // if user already have avatar
            if (user.avatar?.public_id) {
                // first delete the old image
                cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

                // then add other avatar
                const myCloud = cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150
                });
                user.avatar = {
                    public_id: (await myCloud).public_id,
                    url: (await myCloud).secure_url
                }
            } else {
                const myCloud = cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150
                });
                user.avatar = {
                    public_id: (await myCloud).public_id,
                    url: (await myCloud).secure_url
                }
            }
        }

        await user?.save();

        await redis.set(userId, JSON.stringify(user));

        res.status(201).json({
            success: true,
            user
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


//get all users -- only admin
export const getAllUsers = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllUsersService(req, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// update user role -- only for admin
export const updateUserRole = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, role } = req.body;
        updateUserRoleService(id, role, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// delete user -- only for admin
export const deleteUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findById(id);

        if (!user) {
            return next(new ErrorHandler("User Not Found", 404));
        }

        await user.deleteOne({ id });

        await redis.del(id);

        res.status(201).json({
            success: true,
            message: "User deleted successfully"
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});