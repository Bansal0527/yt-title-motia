import { ApiRouteConfig } from "motia";



// step 1 
// accept user channel 
export const config: ApiRouteConfig = {
    name : "SubmitChannel",
    path : "/submit",
    type : "api",
    method : "POST",
    emits : ["yt.submit"]
}


interface SubmitRequest {
    channel : string,
    email : string
}

export const handler = async (req: any, {emit, logger, state}: any) => {
    try {
        logger.info("Received submission ", {body : req.body});
        const {channel, email}  = req.body as SubmitRequest;

        if(!channel || !email) {
            return {
                status : 400,
                body : {
                    error : "channel and email are required"
                }
            }
        }

        // validate
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)) {
            return {
                status : 400,
                body : {
                    error : "Invalid email format"
                }
            }
        }

        const jobId = `job_${Date.now()}`;

        await state.set(`job : ${jobId}`, {
            jobId,
            channel,
            email,
            status : "queued",
            createdAt : new Date().toISOString()
        })

        logger.info('Job created', {jobId, channel, email});

        await emit({
            topic : "yt.submit",
            data : {
                jobId,
                channel,
                email
            }
        })

        return {
            status : 200,
            body : {
                success : true,
                jobId,
                message : "Submission received and job queued"
            }
        }

    } catch (error: any) {
        logger.error("Error in submission handler ", {error : error.message});
        return {
            status : 500,
            body : {
                error : "Internal Server Error"
            }
        }
    }
}