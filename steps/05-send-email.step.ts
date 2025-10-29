import { EventConfig } from "motia";
import OpenAI from "openai";
import { Resend } from 'resend';



// step - 5
// sends formatted email with improved titles
export const config = {
    name : "SendEmail",
    type : "event",
    subscribes : ["yt.titles.ready"],
    emits : ["yt.email.send"],
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
        const data = eventData || {}
        jobId = data.jobId;
        const email = data.email ;
        const channelName = data.channelName;
        const improvedTitles = data.improvedTitles

        logger.info("Sending email", {jobId, email, titles : improvedTitles.length});

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
        if(!RESEND_API_KEY) {
            throw new Error("Rsend API KEY is not set");
        }

        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "sending email",
        })

        const emailText = generateEmailText(channelName, improvedTitles);

        const resend = new Resend(RESEND_API_KEY);

        const response = await resend.emails.send({
            from: RESEND_FROM_EMAIL,
            to: [email],
            subject: `New titles for ${channelName}`,
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

          await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "completed",
            emailId : emailResult.id,
            completedAt : new Date().toISOString()
        })

        await emit({
            topic : "yt.email.send",
            data : {
                jobId, 
                email,
                emailId : emailResult.id,
            }
        }) 

        return;


    } catch (error :any) {
        logger.error("Error in sending email ", {error : error.message });

        if(!jobId ) {
            logger.error("Missing jobId  in error handling");
            return;

        }
        const jobData = await state.get(`job : ${jobId}`);

        await state.set(`job : ${jobId}`, {
            ...jobData,
            status: "failed",
            error: error.message,
        })

        
    }
}

function generateEmailText(
    channelName: string,
    titles: ImprovedTitle[]
): string {
    let html = `<h1>Youtube Title Doctor - Improved Titles for ${channelName}</h1>`;
    html += `<hr style="border: 1px solid #000; margin: 20px 0;">`;

    titles.forEach((title, idx) => {
        html += `<h2>Video ${idx + 1}:</h2>`;
        html += `<p><strong>Original:</strong> ${title.original}</p>`;
        html += `<p><strong>Improved:</strong> ${title.improved}</p>`;
        html += `<p><strong>Why:</strong> ${title.rationale}</p>`;
        html += `<p><strong>URL:</strong> <a href="${title.url}">${title.url}</a></p>`;
        html += `<hr style="border: 1px solid #000; margin: 20px 0;">`;
    });

    html += `<footer style="text-align: center; margin-top: 20px;">Powered By Motia.dev</footer>`;

    return html;
}