import { EventConfig } from "motia";
import OpenAI from "openai";



// step - 4
// user gemini model to generate improved titles for videos
export const config = {
    name : "GenerateTitles",
    type : "event",
    subscribes : ["yt.videos.fetched"],
    emits : ["yt.titles.ready", "yt.titles.error"],
}

interface Video{
    videoId : string;
    title : string;
    url : string;
    publishedAt : string;
    thumbnail : string;
}

interface ImprovedTitle{
    original : string;
    improved : string;
    url : string;
    rationale : string;
}


export const handler = async (eventData: any, {emit, logger, state}: any) => {

    let jobId: string | undefined;
    let email: string | undefined;

    try {
        const data = eventData || {};
        jobId  = data.jobId;
        email = data.email;
        const videos = data.videos
        const channelName = data.channelName;
        logger.info("Resolving channel", {jobId, videoCount : videos.length});

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if(!GEMINI_API_KEY) {
            throw new Error("GEMINI API KEY is not set");
        }

        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "generating titles",
        })

        const videosTitles = videos.map((v: Video, idx: number) => `${idx + 1}. "${v.title}"`).join('\n')

        const prompt = `You are a Youtube title optimization expert. Below are ${videos.length} video titles from a Youtube channel named "${channelName}".
        
        For each title , provide :
        1. An imporoved version that is more engaging , 
        SEO - friendly, and likely to get more clicks.
        2. A brief rationale (1-2 sentences) explaining why the imporved title is better. 

        Guidelines :
        - Keep the core topic and authticity
        - Use action verbs, numbers, and specific value propositions
        - Make it curiosity-including without being clickbait
        - Optimise for searchability and clarity

        Video Titles :
        ${videosTitles}

        Respond in JSON format:
        {
            "titles" : [
                {
                "original" : "...",
                "improved" : "...",
                "rationale" " "...",
                }
            ]
        }`

        const openai = new OpenAI({
            apiKey: GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
        });
        
        const response = await openai.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: [
                { role: "system", 
                    content: "You are a youtube SEO and engagement expert who helps creators write better video titles" },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature : 0.7,
            response_format : {type : 'json_object'}
        });

        if(!response.choices || response.choices.length ===0) {
            throw new Error("No response from AI model")

        }

        const aiResponse = response.choices[0].message
        logger.info("AI result",response.choices[0].message);
        
        // const parsedResponse = aiResponse?.response_format.json_object
        if (!aiResponse.content) {
            throw new Error("AI response content is null");
        }
        const parsedResponse = JSON.parse(aiResponse.content);
        const improvedTitles: ImprovedTitle[] = parsedResponse.titles.map((title:any, idx : number) => ({
            original : title.original,
            improved : title.improved,
            rationale : title.rationale,
            url : videos[idx].url
        }));

        logger.info("Titles generated successfully", {jobId, count: improvedTitles.length})

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "Titles ready",
            improvedTitles
        })

        await emit({
            topic : "yt.titles.ready",
            data : {
                jobId, 
                email,
                channelName,
                improvedTitles
            }
        }) 

        return; 



    } catch (error: any) {
        logger.error("Error in generating titles ", {error : error.message });

        if(!jobId || !email) {
            logger.error("Missing jobId or email in error handling");
            return;

        }
        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "failed",
            error: error.message,
        })

        await emit({
            topic : "yt.titles.error",
            data : {
                jobId, 
                email,
                error : "failed to generate titles"
            }
        })
    }
}