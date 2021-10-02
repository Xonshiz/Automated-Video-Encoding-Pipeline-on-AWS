import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { User } from '@app/_models';
import { UserService } from '@app/_services';
import { UploadService } from '../_services/upload.service';

@Component({ templateUrl: 'admin.component.html', providers: [UploadService] })
export class AdminComponent implements OnInit {
    loading = false;
    users: User[] = [];
    selectedFiles: FileList;
    public fileUploadMessage;

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

    upload() {
        if (this.selectFile.length == 0) {
            return;
        }
        const file = this.selectedFiles.item;
        this.fileUploadMessage = "Uploading your file...";
        var fileUploadProgress = this.uploadService.uploadFile(file);
        fileUploadProgress.on('httpUploadProgress', (progress) => {
            this.fileUploadMessage = `Uploaded ${this.convertBytesToMegaBytes(progress.loaded)} MB of ${this.convertBytesToMegaBytes(progress.total)} MB....`;
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
        }
    }

    convertBytesToMegaBytes(bytes) {
        if (bytes && !isNaN(+bytes)) {
            return Math.round(+bytes / (1024 * 1024));
        }
    }
}