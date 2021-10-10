#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Author: Xonshiz
Date: 2021-09-11
Description: This script downloads the main script that'll be used to encode the input video in the docker.
"""

import boto3
from os import environ, path, mkdir, sep, remove
from sys import exit
from shutil import rmtree
import ffmpy
import subprocess
import json
from urllib.parse import unquote_plus
from re import findall, sub


def path_creator(path_to_create):
    if not path_to_create:
        return path_to_create
    sub_path = path.dirname(path_to_create)
    if not path.exists(sub_path):
        path_creator(sub_path)
    if not path.exists(path_to_create):
        mkdir(path_to_create)
    return path_to_create


def delete_downloaded_resource(paths_to_remove):
    for path_to_remove in paths_to_remove:
        try:
            rmtree(path_to_remove)
        except Exception:
            try:
                remove(path_to_remove)
            except Exception:
                print("Coudln't remove: {0}".format(path_to_remove))
                pass


def file_exist(file_name):
    return path.exists(path.abspath(file_name))


def execute_encode(command):
    try:
        print("--------\nFFMPEG Command : {0}\n------------\n".format(command))
        subprocess.call(command, shell=True)
        return True
    except Exception as FfmpegExecutionError:
        print("Exception while ffmpeg execution.\nStack Trace : {0}\n------------\n".format(FfmpegExecutionError))
        return False


def get_video_metadata(input_file):
    ffprobe = ffmpy.FFprobe(
        global_options="-loglevel quiet -sexagesimal -of json -show_entries stream=width,"
                       "height,bit_rate -show_entries format=duration -select_streams v:0",
        inputs={input_file: None})
    print("ffprobe.cmd: {0}".format(ffprobe.cmd))  # printout the resulting ffprobe shell command
    stdout, stderr = ffprobe.run(stderr=subprocess.PIPE, stdout=subprocess.PIPE)
    # std* is byte sequence, but json in Python 3.5.2 requires str
    ff0string = str(stdout, 'utf-8')

    ffinfo = json.loads(ff0string)
    # If we have an invalid video file, gotta return NONE.
    if not ffinfo or len(ffinfo) == 0:
        ffinfo = None
    return dict(ffinfo)


def download_file_from_s3(boto_client, bucket_name, source_file, output_file_name):
    try:
        boto_client.download_file(bucket_name, source_file, output_file_name)
    except Exception as NoFileFound:
        print("Couldn't find s3://{0}/{1} specified file in S3.".format(bucket_name, source_file))
        print("Error: {0}".format(NoFileFound))
    return file_exist(output_file_name)


def upload_file_to_s3(boto_client, bucket_name, source_file_name, output_file_name):
    try:
        boto_client.upload_file(source_file_name, bucket_name, output_file_name)
    except Exception:
        pass


def delete_file_from_s3(boto_client, bucket_name, source_file_name):
    try:
        boto_client.delete_object(Bucket=bucket_name, Key=source_file_name)
    except Exception:
        pass


def encode_base_command(input_file, options, output_file):
    command = 'ffmpeg -y -i "{0}" {1} -c:a copy "{2}"'.format(input_file, options, output_file)
    return command


def get_video_codec_command(encode_method, vbv_maxrate):
    if encode_method == "x265":
        """
        —subme 7
        limit-refs 0
        —qg-size 64
        —vbv-maxrate 2500
        —me star
        —bframes 16
        —rc-lookahead 240
        —lookahead-slices 0
        —ref 6
        """
        command = "-c:v libx265  -crf 25 -preset slow -trellis 2"
    else:
        """
        —subme 9
        —vbv-maxrate 2500
        -me umh
        —bframes 16
        -refs 4
        -trellis 1
        """
        command = "-c:v libx264 -preset slow -refs 4 -trellis 2"
    if vbv_maxrate and int(vbv_maxrate) > 0:
        command += " -v:b {0} -maxrate {0} -bufsize 1M".format(vbv_maxrate)
    return command


def build_second_pass_ffmpeg_command(encode_type, input_file, options, output_file, current_video_bitrate):
    command = encode_base_command(input_file, "{0} {1}".format(options, get_video_codec_command(encode_type,
                                                                                                current_video_bitrate)),
                                  output_file)
    return command


"""
Actual File: s3://batch-stuff/input/My Movie [x264] [x265].mp4
Event File: s3://batch-stuff/input/My+Movie+%5Bx264%5D+%5Bx265%5D.mp4
"""


def get_sane_file_name(file_name):
    if not file_name:
        return ""
    else:
        return str(file_name).replace("'", "").strip()


def remove_resolutions_from_file(file_name):
    if not file_name:
        return ""
    else:
        return sub(r'\[(\b\d[\d,\s+]*\b)\]', '', str(file_name))
        # if matches:
        # for match in matches:
        #     file_name = str(file_name).replace(match, '')


if __name__ == '__main__':
    print("Running Encoding Script")
    if len(environ) == 0:
        print("No environment variables provided. Exiting.")
    else:
        input_bucket_name = environ.get("input_bucket_name", None)
        if not input_bucket_name:
            print("Input bucket is required.")

        output_bucket_name = environ.get("output_bucket_name", None)
        if not output_bucket_name:
            output_bucket_name = input_bucket_name
            print("Using INPUT BUCKET as OUTPUT BUCKET.")

        input_file_key = environ.get("input_file_key", None)
        if not input_file_key:
            print("File name is required.")
        if str(input_file_key).lower().strip()[-1] == "/":
            print("Input file is a directory")
            exit(1)

        input_file_key = unquote_plus(input_file_key)
        encode_types = []
        encode_type = environ.get("encode_type", None)

        if not encode_type:
            if "[x264]" in str(input_file_key).lower().strip():
                encode_types.append("x264")
            if "[x265]" in str(input_file_key).lower().strip():
                encode_types.append("x265")
            else:
                encode_types.append("x264")
        else:
            encode_type = str(encode_type).lower().replace('p', '').strip()
            encode_types = str(encode_type).split(',')

        required_resolutions = []
        # use_source_resolution = False
        required_resolutions_input = environ.get("required_resolutions", None)
        if required_resolutions_input:
            required_resolutions = required_resolutions_input.strip().split(",")
        else:
            matches = findall(r'\[(\b\d[\d,\s+]*\b)\]', str(input_file_key))
            if matches:
                for match in matches:
                    if not str(match).isdigit():
                        required_resolutions = match.strip().split(",")
                        break
                    else:
                        required_resolutions.append(str(match).strip())
                        break
        s3_client = boto3.client('s3')
        downloaded_paths = []
        input_file_name = path.abspath(get_sane_file_name(input_file_key))

        file_downloaded = download_file_from_s3(s3_client, input_bucket_name, input_file_key, input_file_name)
        if not file_downloaded:
            print("Failed to download file")
        else:
            for current_encode_type in encode_types:
                file_metadata = get_video_metadata(input_file_name)
                if file_metadata:
                    video_width = file_metadata.get("streams", [{"width": 0}])[0]["width"]
                    video_bitrate = file_metadata.get("streams", None)
                    if video_bitrate:
                        video_bitrate = video_bitrate[0]["bit_rate"]
                    files_to_upload = []
                    output_files = []
                    encode_commands = []
                    if len(required_resolutions) == 0 and video_width:
                        required_resolutions.append(video_width)

                    for video_resolution in required_resolutions:
                        current_options = ""
                        if video_resolution.lower().strip() != str(video_width):
                            current_options = "-y -vf scale={0}:-2,setsar=1:1".format(video_resolution)
                        input_file_key_simple = str(input_file_key).split('/')[-1]
                        input_file_key_simple = input_file_key_simple.replace('[x264]', '').replace('[x265]',
                                                                                                    '').strip()
                        file_name_split = get_sane_file_name(input_file_key_simple).split(".")
                        file_name_split[0] = str(remove_resolutions_from_file(file_name_split[0])).strip()
                        output_directory_name = file_name_split[0] + sep + current_encode_type
                        path_creator(output_directory_name)
                        downloaded_paths.append(path.abspath(file_name_split[0]))
                        final_output_name = "{0} [{1}].{2}".format(file_name_split[0], video_resolution,
                                                                   file_name_split[-1])
                        final_output_name = path.abspath(
                            file_name_split[0] + sep + current_encode_type + sep + final_output_name)
                        current_encode_command = build_second_pass_ffmpeg_command(current_encode_type, input_file_name,
                                                                                  current_options,
                                                                                  final_output_name, video_bitrate)
                        encode_commands.append(current_encode_command)
                        output_files.append(final_output_name)
                    final_encode = ' && '.join(encode_commands)
                    execute_encode(final_encode)
                    if len(output_files) > 0:
                        for current_file in output_files:
                            upload_key_name = "Output/{0}/{1}/{2}".format(str(current_file).split('/')[-3],
                                                                          str(current_file).split('/')[-2],
                                                                          str(current_file).split('/')[-1])
                            upload_file_to_s3(s3_client, output_bucket_name, current_file, upload_key_name)
                        delete_downloaded_resource(set(downloaded_paths))
        delete_file_from_s3(s3_client, input_bucket_name, input_file_key)
        delete_downloaded_resource([input_file_name])
    exit(0)