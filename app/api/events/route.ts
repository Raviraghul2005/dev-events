import { EventModel } from '@/database/event.model';
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import {v2 as cloudinary} from 'cloudinary';

type CloudinaryUploadResult = {
    secure_url: string;
    public_id: string;
};

const parseStringArrayField = (formData: FormData, field: string) => {
    const rawValue = formData.get(field);

    if (typeof rawValue !== "string") {
        return { error: `${field} is required.` };
    }

    try {
        const parsedValue = JSON.parse(rawValue);

        if (
            !Array.isArray(parsedValue) ||
            parsedValue.length === 0 ||
            !parsedValue.every((item): item is string => typeof item === "string" && item.trim().length > 0)
        ) {
            return { error: `${field} must be a JSON array of non-empty strings.` };
        }

        return { value: parsedValue.map((item) => item.trim()) };
    } catch {
        return { error: `${field} must be valid JSON.` };
    }
};

export async function POST(req: NextRequest){
    try{
        await connectToDatabase();

        let formData: FormData;

        try{
            formData = await req.formData();
        }catch{
            return NextResponse.json({message: 'Invalid JSON data format '},{status :400})
        }

        const event = Object.fromEntries(formData.entries());
        const file = formData.get('image');

        if(!(file instanceof File) || file.size === 0){
            return NextResponse.json({message:'Image not Uploaded'}, {status:400})
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer)

        const parsedTags = parseStringArrayField(formData, "tags");
        const parsedAgenda = parseStringArrayField(formData, "agenda");

        if (parsedTags.error || parsedAgenda.error) {
            return NextResponse.json(
                { message: "Invalid event data.", error: parsedTags.error ?? parsedAgenda.error },
                { status: 400 },
            );
        }

        const tags = parsedTags.value;
        const agenda = parsedAgenda.value;

        const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject)=>{
            cloudinary.uploader.upload_stream({resource_type: 'image', folder: 'DevEvents'}, (error, results)=>{
                if(error) {
                    console.error("Cloudinary upload failed:", error);
                    return reject(error);
                }

                if(!results?.secure_url || !results.public_id) {
                    return reject(new Error("Cloudinary did not return image details."));
                }

                resolve({secure_url: results.secure_url, public_id: results.public_id});
            }).end(buffer);
        })

        event.image = uploadResult.secure_url;

        let createdEvent;

        try{
            createdEvent = await EventModel.create({
                ...event,
                tags,
                agenda
            })
        }catch(e){
            try{
                await cloudinary.uploader.destroy(uploadResult.public_id, {resource_type: 'image'});
            }catch(cleanupError){
                console.error("Cloudinary cleanup failed:", cleanupError);
            }

            throw e;
        }

        return NextResponse.json({message: 'Event Created Successfully', event: createdEvent}, {status : 201})
    }catch(e){
        console.log(e);

        const cloudinaryError = e as { http_code?: number; message?: string };

        if(cloudinaryError.http_code){
            return NextResponse.json(
                {message:'Image upload failed', error: cloudinaryError.message},
                {status :502}
            )
        }

        return NextResponse.json({message:'Event Creation Failed', error: e instanceof Error? e.message:'Unknown '},{status :500})
    }

}


export async function GET(){
    try{
        await connectToDatabase()

        const events = await EventModel.find().sort({createdAt: -1});

        return NextResponse.json({message: 'Events fetched successfully', events},{status:200})
    } catch(e){{
        return NextResponse.json({message : 'Event Fetching Failed',error:e},{status:500})
    }}
}

//a route that accepts a slug as input -> returns the event details
