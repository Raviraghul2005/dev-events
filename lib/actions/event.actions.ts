'use server';

import { EventModel } from "@/database/event.model";
import connectToDatabase from "../mongodb";

export const getSimilarEventsBySlug = async(slug:string)=>{
    try{
        await connectToDatabase();

        const event = await EventModel.findOne({slug});
        return await EventModel.find({
            _id: { $ne: event._id },
            tags: { $in: event.tags },
            })
            .select("title image slug location date time")
            .lean();

        
    } catch(e){
        return [];
    }
}