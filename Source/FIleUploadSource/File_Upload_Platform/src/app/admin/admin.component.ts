import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';

import { User } from '@app/_models';
import { UserService } from '@app/_services';
import { UploadService } from '../_services/upload.service';
import { environment } from '@environments/environment';

@Component({ templateUrl: 'admin.component.html', providers: [UploadService] })
export class AdminComponent implements OnInit, AfterViewInit {
    @ViewChild('user_email_field') user_email_field;
    @ViewChild('bucket_name_field') bucket_name_field;
    loading = false;
    users: User[] = [];
    selectedFiles: FileList;
    public fileUploadMessage;
    public enableSubmitButton: boolean = false;
    errorMessage: string = "";

    constructor(private userService: UserService,
        private uploadService: UploadService) { }

    ngOnInit() {
        this.loading = true;
        this.fileUploadMessage = "";
        this.userService.getAll().pipe(first()).subscribe(users => {
            this.loading = false;
            this.users = users;
        });
    }

    ngAfterViewInit(){
        this.user_email_field.nativeElement.value = localStorage.getItem('user_email_field');
        this.bucket_name_field.nativeElement.value = localStorage.getItem('bucket_name_field');
    }

    upload() {
        this.errorMessage = "";
        
        if (this.selectFile?.length == 0) {
            return;
        }
        if(!this.user_email_field || !this.user_email_field.nativeElement.value){
            this.errorMessage = "A Valid Email Id is required.";
            return;
        }
        if(!this.bucket_name_field || !this.bucket_name_field.nativeElement.value){
            this.errorMessage = "A Valid AWS Bucket Name is required.";
            return;
        }

        localStorage.setItem('user_email_field', this.user_email_field.nativeElement.value);
        localStorage.setItem('bucket_name_field', this.bucket_name_field.nativeElement.value);

        const file = this.selectedFiles.item;
        this.fileUploadMessage = "Uploading your file...";
        var fileUploadProgress = this.uploadService.uploadFile(file);
        fileUploadProgress.on('httpUploadProgress', (progress) => {
            this.fileUploadMessage = `Uploaded ${this.convertBytesToMegaBytes(progress.loaded)} MB of ${this.convertBytesToMegaBytes(progress.total)} MB....`;
            if(progress?.loaded === progress?.total){
                this.fileUploadMessage = "File Successfully Uploaded.";
            }
        });
        fileUploadProgress.promise().then((promise) => {
            var params = {
                TableName: environment.awsDynamoDb,
                Item: {
                    'key_name' : {S: promise.Key}, 
                    'user_email' : {S: this.user_email_field.nativeElement.value},
                    'bucket_name': {S: this.bucket_name_field.nativeElement.value}
                }
              };
            var putDataInDb = this.uploadService.addDataInDynamoDB(params);
            putDataInDb.promise().then((promise) => {
                if(promise?.$response?.httpResponse?.statusCode == 200 && !promise?.$response?.error){
                    console.log(`Added data in DB: ${promise}`);
                }
            });
        });
    }

    selectFile(event) {
        var final_files: FileList = {
            item: null,
            length: 0
        };
        var selectedFiles = event.target.files;
        for (var i = 0; i < selectedFiles.length; ++i) {
            if (String(selectedFiles[i].type).toLowerCase().indexOf('video') > -1 && selectedFiles[i].size < 52428800) {
                final_files.item = selectedFiles[i];
            }
        }
        if (final_files.item) {
            this.selectedFiles = final_files;
            this.errorMessage = "";
        } else{
            this.errorMessage = "Only .mp4,.flv,.mkv upto 50 MB are allowed.";
        }
    }

    convertBytesToMegaBytes(bytes) {
        if (bytes && !isNaN(+bytes)) {
            return Math.round(+bytes / (1024 * 1024));
        }
    }
}