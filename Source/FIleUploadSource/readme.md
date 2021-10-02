# Video Encoding Notifier Application
This application is a POC to demonstrate how the underlying "Video Encoding Batch Job" application can be utilized. This is a very simple application to upload videos to encode them on the AWS Video Encoding pipeline we've built and get email notification when the encode is finished.

We'll have a simple front-end application to upload file and in AWS, we have a lambda function that gets triggered whenever a file is uploaded in the output directory of the specified S3 bucket and uses AWS SES to send notification emails.

SES is something that you need to setup yourself and remember that by default, SES runs in a sandbox and you'll not be able to send emails to email IDs that aren't validated via SES.

Keep in mind that this CloudFormation template will create a `DynamoDB` table to save the necessary record info. That will have its own charges.

### Must Know!
This is a POC and should be treated like one. However, if you want to deploy this project, there are 2 ways that I can think of:
- Running in EC2 : You don't need to provide Access ID and Secret Key, just ensure that the role attached to your EC2 instance has sufficient rights/access.
- Running elsewhere: It's generally not a good practice to embed secret token in your angular app, would suggest to host a node back-end, which can access yoru credentials via more secure way and any task of connecting to your AWS resources should be done via that nodeJS back-end, instead of making direct calls from your Angular project.

### Prerequisites
As simple as building an Angular project, nothing fancy. However, fill the environment details in `envrironment.ts` file.
- Provide proper values to variabels in `environment.ts` file and `environment.prod.ts` file.
- Run `npm i` to install dependencies.
- Run `ng serve --open` to verify whether your changes are working properly or not.
- Run `ng build --prod` and it'll make a `dist` folder. You need to copy this `dist` folder to whichever place you want to host this application.
- `Zip` this `dist` folder and name it `dist.zip`.

### Creating Lambda Function
We're re-using the S3 bucket we created in our main "Video Encoding Pipeline" and you can find the name of the bucket in `S3Bucket` paramter in the `workflow.yaml` file. Download the `index.js` file from this repo and zip it and name it `index.zip` and upload the zip file in the S3 bucket you're using for this. This is monumental because our CloudFormation will pull this zip file and put its code in Lambda function we're creating.

### Deplying on EC2
##### Deploying EC2 Instance
Make sure you have a keypair in your AWS account in the same region. Replace the value of `KeyName` parameter in the `deploy_ec2.yaml`. We'll need this Keypair to log into our launched EC2 instance because we'll need to install and run `httpd` server and then host our angular project.
- Use the `public_ec2_launcher.yaml` CloudFormation template to deply an EC2 instance.
- Make sure your EC2 instance is accessible via its public IP.
- Make sure you have downloaded the keypair in your system (the one you've attached to this EC2 instance).
- Copy that keypair into the directory where you have your `dist.zip` file (made in last step of #Prerequisites).

##### Deploying Angular App to EC2
- Run this command and make sure to replace the IP with your instance's I.P.
```
scp -i EncodingJobKeyPairEC2.pem ./dist.zip ec2-user@ec2-XX-XXX-XXX-XXX.compute-1.amazonaws.com:~/.
```

Now, log into your EC2 instance via this command:
```
ssh -i "./EncodingJobKeyPairEC2.pem" ec2-user@ec2-XX-XXX-XXX-XXX.compute-1.amazonaws.com
```
Go to your usr's home directory `cd /home/ec2-user` and check whether you dist folder files are there or not. There should be your `dist.zip` file you just uploaded. Now it's time to unzip this file. Just run
```
unzip dist.zip
```
Now, let's install some libraries/tools. Just run these commands:
```
yum update -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install node
yum -y install httpd
service httpd start
```

If you've read the cloudformation template, you'll see these exact lines in the `userdata` section. Well, those should've ran, but for some reason those commands didn't run for me and I had to execute them manually. So, good for you to run these, just in case.

Now, just copy the unzipped file's content to our httpd sever's directory via :
```
sudo cp -R File_Upload_Platform/* /var/www/html/
```

If everything went fine, you should now be able to access the website via your EC2 instance's public IP.

##### Adding Event to trigger Lambda Function
First, download the `index.zip` file from this repository and upload it into the S3 bucket. Remember to update the bucket name in the `file_upload_cf.yaml`.Now, create another stack in CloudFormation with `file_upload_cf.yaml` file.Then go to the lambda function created with this CF tempalte and add a trigger to it. The trigger source would be the `S3` bucket which will have our Outputed encoded file.**Remember to add the prefix of the OUTPUT folder** while creating the trigger, otherwise your lambda function will be triggered for everything you upload in that entire S3 bucket.

### Credits
I've pulled the rle based authorization angular template from `[Jason Watmore's Github](https://github.com/cornflourblue/angular-10-role-based-authorization-example)`. I've used it as a base to show the more "realistic" approach of a streaming website where an "admin" can upload a video and a "user" can only watch the videos. Everything else related to file upload, AWS connections etc. are the things I've implemented. Not the cleanest code, I know, but it works!