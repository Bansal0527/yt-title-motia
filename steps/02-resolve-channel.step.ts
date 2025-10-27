import { EventConfig } from "motia";



// step -2 
// converts youtube name to channel id using youtube data api
export const config: EventConfig = {
    name : "ResolveChannel",
    type : "event",
    subscribes : ["yt.submit"],
    emits : ["yt.channel.resolved", "yt.channel.error"],
}


export const handler = async (eventData: any, {emit, logger, state}: any) => {

    let jobId: string | undefined;
    let email: string | undefined;


    try {
        const data = eventData || {};
        jobId  = data.jobId;
        email = data.email;
        const channel = data.channel;
        
        logger.info("Resolving channel", {jobId, channel});

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        if(!YOUTUBE_API_KEY) {
            throw new Error("YOUTUBE_API_KEY is not set");
        }

        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "resolving channel",
        })

        let channelId : string | null = null;
        let channelName : string = ""
        if(channel.startWith('@')) {
            const handle = channel.substring(1);

            const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;

            const searchResponse = await fetch(searchURL)

            const searchData = await searchResponse.json();

            if(searchData.items && searchData.items.length > 0) {
                channelId = searchData.items[0].snippet.channelId;
                channelName = searchData.items[0].snippet.title;
                logger.info("Resolved channel id", {channelId}); 
            }

        }

        else {
            const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channel)}&key=${YOUTUBE_API_KEY}`;

            const searchResponse = await fetch(searchURL)
            const searchData = await searchResponse.json();

            if(searchData.items && searchData.items.length > 0) {
                channelId = searchData.items[0].snippet.channelId;
                channelName = searchData.items[0].snippet.title;
                logger.info("Resolved channel id", {channelId}); 
            }
        }

        if(!channelId) {
            logger.error("Failed to resolve channel id", {channel});
            await state.set(`job : ${jobId}`, {
                ...jobData,
                status: "channel not found"
            })

            // await emit({
            //     topic: "yt.channel.error",
            //     data : {
            //         jobId,
            //         email,
            //     }
            // })
        }

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "channel resolved",
            channelId,
            channelName
        })

        await emit({
            topic: "yt.channel.resolved",
            data : {
                jobId,
                email,
            }
        })

        return; 
    } catch (error: any) {
        logger.error("Error in ResolveChannel step", {error : error.message });

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
            topic : "yt.channel.error",
            data : {
                jobId, 
                email,
                error : "failed to resolve the channel"
            }
        })
    }
}