import { EventConfig } from "motia";



// step -3
// retrives latest 5 videos from channel name 
export const config = {
    name : "FetchedVideos",
    type : "event",
    subscribes : ["yt.channel.resolved"],
    emits : ["yt.videos.fetched", "yt.videos.error"],
}

interface Video{
    videoId : string;
    title : string;
    url : string;
    publishedAt : string;
    thumbnail : string;
}


export const handler = async (eventData: any, {emit, logger, state}: any) => {

    let jobId: string | undefined;
    let email: string | undefined;


    try {
        const data = eventData || {};
        jobId  = data.jobId;
        email = data.email;
        const channelId = data.channelId;
        const channelName = data.channelName;
        logger.info("Resolving channel", {jobId, channelId});

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        if(!YOUTUBE_API_KEY) {
            throw new Error("YOUTUBE_API_KEY is not set");
        }

        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "fetching videos",
        })



        const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=5&key=${YOUTUBE_API_KEY}`;

        const response = await fetch(searchURL)

        const youtubeData = await response.json();

        if(!youtubeData.items  || youtubeData.items.length === 0) {
            logger.warn("No videos found for the channel", {jobId, channelId});
            await state.set(`job : ${jobId}`, {
                ...jobData,
                status: "failed",
                error: "No videos found"
            })

            await emit({
                topic : "yt.videos.error",
                data : {
                    jobId, 
                    email,
                    error : "No videos found"
                }
            })

            return 
        }   

        const videos : Video[] = youtubeData.items.map((item: any) => ({
            videoId : item.id.videoId,
            title: item.snippet.title,
            url : `https://www.youtube.com/watch/?v=${item.id.videoId}`,
            publishedAt : item.snippet.publishedAt,
            thumbnail : item.snippet.thumbnails.default.url
        }));

        logger.info("Videos fetched sucessfully", {
            jobId,
            videoCount : videos.length
        })

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "Videos fetched",
            videos
        })

        await emit({
            topic : "yt.videos.fetched",
            data : {
                jobId, 
                email,
                videos,
                channelName,
            }
        }) 

        return; 
    } catch (error: any) {
        logger.error("Error in fetching videos ", {error : error.message });

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
            topic : "yt.videos.error",
            data : {
                jobId, 
                email,
                error : "failed to fetch videos"
            }
        })
    }
}