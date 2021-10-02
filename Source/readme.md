# POC Apps

I've created 2 differnt web apps to demonstrate how this "video encoding pipeline" can be used. Just keep in mind that this is just a POC and security wasn't the main concern for this. You should NOT use this in prod as it is. Use these templates as a guiding point only.

#### POC 1 (File Upload Platform)
This POC demonstrates a simple web app where you could upload a video file and provide your email and your amazon bucket where this video file should be saved. The email you provide here will be used to send an email to, when the video has been encoded. You should receive a public streamable link.

#### POC 2 (Video Streaming Platform)
This POC demonstrates how you could build a platform like YouTube. Certain set of users (admins) could upload a video and it'll be enoded and saved in S3. Meanwhile the normal users and admins could also stream all these videos via the homepage.


More information about these projects is available in their respective directories with a detailed readme. Just keep in mind that you need deploy the encoding pipeline from the `video_encoding_pipeline_cf.yaml` file.

Make sure to update proper info in the `environment.ts` files before you push the code or build the webapp.

These 2 apps were built on top of some open source angular authentication based examples and I've credited the source in the ReadMe files of each project.