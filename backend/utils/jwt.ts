import dotenv from "dotenv";
import { NextFunction, Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";
import ErrorHandler from "./Errorhandler";

interface ITokenOptions {
    expires: Date,
    maxAge: number,
    httpOnly: boolean,
    sameSite: 'lax' | 'strict' | 'none' | undefined,
    secure?: boolean
}

const accessTokenExpires = parseInt(process.env.ACCESS_TOKEN_EXPIRES || '300', 10);
const resfreshTokenExpires = parseInt(process.env.REFRESH_TOKEN_EXPIRES || '1200', 10);


// options for cookies
export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpires * 60 * 1000),
    maxAge: accessTokenExpires * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
}

export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + resfreshTokenExpires * 24 * 60 * 60 * 1000),
    maxAge: resfreshTokenExpires * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
}

export const sendToken = (user: IUser, statusCode: number, res: Response) => {
    const accessToken = user.SignAccessToken();
    const refreshToken = user.SignRefreshToken();


    //upload session to redis 
    redis.set(user._id, JSON.stringify(user) as any);


    // only set secure to true in production
    if (process.env.NODE_ENV === 'Production') {
        accessTokenOptions.secure = true;
    }

    res.cookie("access_token", accessToken, accessTokenOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenOptions);

    res.status(statusCode).json({
        success: true,
        user,
        accessToken
    })
}


