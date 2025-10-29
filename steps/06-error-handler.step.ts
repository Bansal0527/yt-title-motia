import { EventConfig } from "motia";
import OpenAI from "openai";
import { Resend } from 'resend';



// step - 5
// sends formatted email with improved titles
export const config = {
    name : "SendEmail",
    type : "event",
    subscribes : ["yt.channel.error", "yt.videos.error", "yt.title.error"],
    emits : ["yt.error.notified"],
}




export const handler = async (eventData: any, {emit, logger, state}: any) => {
    let jobId: string | undefined;
    let email: string | '';
    try {
        const data = eventData || {}
        jobId = data.jobId;
        email = data.email;
        const error = data.error;
    
        logger.info("Handling error notification", {jobId, email});
    
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
            const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
            if(!RESEND_API_KEY) {
                throw new Error("Rsend API KEY is not set");
            }
    
        const emailText = `We are facing some error in generating titles`;
    
        const resend = new Resend(RESEND_API_KEY);
    
            const response = await resend.emails.send({
                from: RESEND_FROM_EMAIL,
                to: [email],
                subject: `Request failed for youtube title generation`,
                html: emailText,
              });
            
              if (response.error) {
                throw new Error('Failed to send Email')
              }
    
              const emailResult = response.data
              logger.info("Email sent successfully", {
                jobId,
                emailId : emailResult.id
              })
    
              await emit({
                topic : "yt.error.notified",
                data : {
                    jobId, 
                    email,
                    emailId : emailResult.id,
                }
            }) 
    
            return;
    } catch (error) {
        logger.error("Failed to send error notification")
    }
}