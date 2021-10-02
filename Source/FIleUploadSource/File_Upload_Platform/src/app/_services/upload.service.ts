import { Injectable } from '@angular/core';
import { DynamoDB, S3 } from "aws-sdk";
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  constructor() { }

  makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  addDataInDynamoDB(params: any){
    const dynamoDBInstance = new DynamoDB({
      accessKeyId: environment.awsAccessKeyId,
      secretAccessKey: environment.awsSecretAccessKey,
      region: environment.awsRegion
    });
    return dynamoDBInstance.putItem(params, function (err, data) {
      if (err) {
        console.log('There was an error adding data: ', err);
        return {
          result: false,
          message: err
        };
      }
      return {
        result: true,
        message: "Successfully uploaded file."
      };
    });
  }

  uploadFile(file): S3.ManagedUpload {
    const contentType = file.type;
    const bucket = new S3(
      {
        accessKeyId: environment.awsAccessKeyId,
        secretAccessKey: environment.awsSecretAccessKey,
        region: environment.awsRegion
      }
    );
    const params = {
      Bucket: environment.awsBucket,
      Key: `input/${this.makeid(5)}_${file.name}`,
      Body: file,
      ACL: 'public-read',
      ContentType: contentType
    };
    return bucket.upload(params, function (err, data) {
      if (err) {
        console.log('There was an error uploading your file: ', err);
        return {
          result: false,
          message: err
        };
      }
      return {
        result: true,
        message: "Successfully uploaded file."
      };
    });
  }
}
