# Graviton 2 Based Video Encoding Batch Job
This is a pretty simple and straightforward architecture that gives you the power to build/automate your very own "video encoding" workflow. It's a complete solution in form of CloudFormation template Very little manual setup is required, as mentioned in #Prerequisites section of this readme.

You can configure whatever you want according to your requirements. This setup is focused on using Graviton2 because it offers 40% higher performance at 20% lower cost than its predecessors. Even Netflix uses these processors.

You can run this setup as is and every time you want to trigger an encode, just upload a valid video file in the `Input` "folder" in the S3 bucket created via this template. S3 doesn't have the concept of "Folders/Directories", however, to visualize the data, you can create a "Folder".

Whenever you add any object in this folder, there's a Lambda event triggered, which will add an AWS BATCH JOB in the queue, i.e., video encoding process.

You can read more in detail on this particular project on [Building an automated Video Encoding Pipeline on AWS](https://itsxonshiz.in/?p=339)

### Must Know!!!
- Go through the "Prerequisites" section before running this template.
- Once you're done launching this template, you'll need to create a "Folder" named "input".
- Once your input video is processed, it's deleted from the "input" folder. So, the source video will be gone. This is done to regulate storage prices. If you wish to remove this functionality, edit the python script before building the docker image.
- You can decide whether to encode in "x264" or "x265" by adding "[x264]" or "[x265]" in the file name. If you don't provide any of these, then "x264" is taken by default.
- You can also specify "[x264] [x265]" in the same file name if you want to trigger both the encoding types.
- By default, it'll create a "1920" wide resolution encode. If you want multiple resolutions, then you can add [1920,1280,640] (for multiple resolutions encodes) or [1920] (for single resolution encode) in the file name. Encode script will automatically scale the video properly. Just provide `width` value.

### Prerequisites
These steps are **MOST IMPORTANT** and should be done before running the CloudFormation template, otherwise, you **will** run into [problems](https://stackoverflow.com/questions/69241422/user-batch-amazonaws-com-is-not-authorized-to-perform-stsassumerole-on-resour).
- Add **`AWSBatchServiceRole`** policy by following [this guide from AWS](https://docs.aws.amazon.com/batch/latest/userguide/service_IAM_role.html).
- Add VPC with a public/private subnet by following [this guide from AWS](https://docs.aws.amazon.com/batch/latest/userguide/create-public-private-vpc.html).
- You'll need to EDIT the "Parameters" section to add the values you will get from following these few previous steps (VPC IDs, Subnets, etc.)
- Install `DOCKER` in your system and follow [this guide to build multi-arch. supported docker images](https://aws.amazon.com/blogs/compute/how-to-quickly-setup-an-experimental-environment-to-run-containers-on-x86-and-aws-graviton2-based-amazon-ec2-instances-effort-to-port-a-container-based-application-from-x86-to-graviton2/). Just follow the tutorial for **`Creating a multi-arch image builder`** and once you're done running this architecture via CF template, follow instructions from this same blog but just this part: **`Creating multi-arch images for x86 and Arm64 and push them to Amazon ECR repository`**.

## Explanation
Since this task has tons of things to setup, this might be a little lengthy CloudFormation template. So, I'll try to explain few things and add some references where I got few things from.

- Base CloudFormation template from : [Justin Plute's Medium Blog](https://medium.com/swlh/aws-batch-to-process-s3-events-388a77d0d9c2).
-  Some more info on setting up an encoding pipeline from [AWS Blog](https://aws.amazon.com/blogs/compute/deploy-an-8k-hevc-pipeline-using-amazon-ec2-p3-instances-with-aws-batch/). Some more ideas from another [AWS Blog](https://aws.amazon.com/blogs/compute/orchestrating-an-application-process-with-aws-batch-using-aws-cloudformation/).

## Architecture
##### Resource Map generated via "Visual Designer" (AWS CloudFormation)
![Resource Map](https://github.com/Xonshiz/Automated-Video-Encoding-Pipeline-on-AWS/blob/main/Images/resource_map.png?raw=true)

##### Architecture
![Architecture Image](https://github.com/Xonshiz/Automated-Video-Encoding-Pipeline-on-AWS/blob/main/Images/architecture.png?raw=true)

#### Metadata Section
This is a general section to take inputs while setting up this whole job. You can provide the "Environment" name, that'll be prepended in the services spawned via this template. You need to specify the VPC ID and Subnet IDs you got from #Prerequisites section.
Best way is to put those IDs in the template itself so that you won't have to select the values manually everytime you set it up.

### S3 Bucket and LambdaInvoke Permission:
Whenever an object is added in our S3 bucket, we raise an event to call Lambda, which creats and adds a JOB Request in AWS Batch. This has a "`DependsOn`" property. This tells S3 to wait for `LambdaInvokePermission` to be done. Read more about this problem [HERE](https://aws.amazon.com/premiumsupport/knowledge-center/lambda-subscribe-push-cloudformation/). Yep, this was another place where I was stuck while building this template.

### ComputeEnvironment
This is where we set out "Compute Environment" in AWS Batch. I'm running the docker images on a `c6g.medium` based machine. It's an instance powered by Arm-based AWS Graviton2 processors. It's the lowest/entry point configuration. If you want to change your Compute Environment type, this'll be the place to do so.
If you want to attach a Key-Pair with this instance, you could do so by adding a `Ec2KeyPair` property like this:
```
Ec2KeyPair: "EncodingJobKeyPairEC2"
```
Where `EncodingJobKeyPairEC2` is the name of an existing Key-pair in that region in your AWS Account. Make sure you have an existing Key-pair with this exact name in the same location where you're launching this whole template.


After you're done with everything, go to CloudFormation dashboard and launch a stack with `video_encoding_pipeline_cf.yaml`. If everything went fine, you'll see all the listed resources.


