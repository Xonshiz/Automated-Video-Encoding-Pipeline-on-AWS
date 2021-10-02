import { Component } from '@angular/core';
import { first, last } from 'rxjs/operators';

import { User } from '@app/_models';
import { UserService, AuthenticationService } from '@app/_services';
import { S3 } from "aws-sdk";
import { environment } from '@environments/environment';

@Component({ templateUrl: 'home.component.html', styleUrls: ['home.component.scss'] })
export class HomeComponent {
    loading = false;
    user: User;
    userFromApi: User;
    public bucketObjects = [];
    openedCollapsiblePanels: Array<any> = [];
    streamDict = {};
    availableStreams = [];
    currentStreamKey = "";
    currentSelectedKey = "";
    showPlayer: boolean = false;

    constructor(
        private userService: UserService,
        private authenticationService: AuthenticationService
    ) {
        this.user = this.authenticationService.userValue;
    }

    ngOnInit() {
        this.loading = true;
        var tempBuckets = [];
        this.userService.getById(this.user.id).pipe(first()).subscribe(user => {
            this.loading = false;
            this.userFromApi = user;
        });
        this.getObjectsFromS3().promise().then(
            (promise) => {
                console.log(`Promise: ${[JSON.stringify(promise.Contents)]}`);
                //this.bucketObjects = promise.Contents;
                tempBuckets = promise.Contents;
                for(var i=0; i < tempBuckets.length; ++i){
                    var currentBucket = tempBuckets[i];
                    var lastChar = currentBucket.Key[currentBucket.Key.length - 1];
                    if(lastChar != "/"){
                        if(String(currentBucket.Key).endsWith('.mp4')){
                            var tempObjectToPush = { 
                                key: currentBucket.Key,
                                resolution: this.getResolutionFromTitle(currentBucket.Key)
                            };
                            if(this.streamDict[this.fileTitleCleaner(currentBucket.Key)]){
                                this.streamDict[this.fileTitleCleaner(currentBucket.Key)].push(tempObjectToPush);
                            } else {
                                this.streamDict[this.fileTitleCleaner(currentBucket.Key)] = [];
                                this.streamDict[this.fileTitleCleaner(currentBucket.Key)].push(tempObjectToPush);
                            }
                            if(this.bucketObjects.indexOf(this.fileTitleCleaner(currentBucket.Key)) === -1){
                                this.bucketObjects.push(this.fileTitleCleaner(currentBucket.Key));
                            }
                        }
                    }
                }
            }
        );
    }
    getResolutionFromTitle(Key: string) {
        var final = "1080";
        var splitHolder = Key?.split(' ');
        final = splitHolder[splitHolder.length - 1].split('.')[0]?.replace('[', '').replace(']', '').trim();
        return final;
    }

    getObjectsFromS3(){
          var params = {
            Bucket: environment.awsBucket
          };
          return new S3({
            accessKeyId: environment.awsAccessKeyId,
            secretAccessKey: environment.awsSecretAccessKey,
            region: environment.awsRegion
          }).listObjectsV2(params, function(err, data) {
            if (err) {
                console.log(`Error: ${err}`);
                console.log(`Error Stack: ${err.stack}`);
            }
          });
    }

    fileTitleCleaner(name: string){
        if(!name){
            return "";
        }
        var name_split = name.split('_');
        name = name_split[name_split.length - 1];
        return name.split('.')[0].replace( new RegExp("\[(0-9)+\]","gm"),"").replace(/[x]/g, '').replace(/\[\]/g, '').replace(/[,]/g, '').trim();
    }

    async getStreamableUrl(bucketObject: any){
        var params = {
            Bucket: environment.awsBucket,
            Key: bucketObject,
            Expires: 3600
          };
        if(!bucketObject){
            return "#";
        } else {
            const validUrl = await new S3({
                accessKeyId: environment.awsAccessKeyId,
                secretAccessKey: environment.awsSecretAccessKey,
                region: environment.awsRegion
              }).getSignedUrl('getObject', params);
              this.currentStreamKey = validUrl;
              this.showPlayer = true;
            
        }
    }

    showCollapsedPanel(key: string){
        if(this.openedCollapsiblePanels.indexOf(key) > -1){
            return true;
        } else{
            return false;
        }
    }

    toggleCollapsiblePane(key: string){
        if(this.openedCollapsiblePanels.indexOf(key) > -1){
            this.openedCollapsiblePanels = [];
            this.availableStreams = [];
            this.currentStreamKey = "";
            this.currentSelectedKey = "";
            this.showPlayer = false;
        } else{
            this.openedCollapsiblePanels = [];
            this.openedCollapsiblePanels.push(key);
            var streams = this.streamDict[this.fileTitleCleaner(key)];
            this.currentSelectedKey = this.fileTitleCleaner(key);
            if(streams){
                for(var i = 0;i < streams.length; ++i){
                    this.availableStreams.push(streams[i].resolution);
                }
            }
        }
    }

    showStream(streamResolution: string){
        if(!this.currentSelectedKey){
            this.showPlayer = false;
            return;
        } else {
            var currentStream = this.streamDict[this.currentSelectedKey];
            if(!currentStream){
                this.showPlayer = false;
                return;
            } else {
                for(var i = 0;i < currentStream.length; ++i){
                    if(currentStream[i].resolution == streamResolution){
                        this.getStreamableUrl(currentStream[i].key);
                        break;
                    }
                }
            }
        }
    }
}