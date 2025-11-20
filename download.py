import os
import sys
import subprocess
from datetime import datetime
from dataclasses import dataclass

import numpy as np
import cv2
import util

video_source = "https://grischuna-cam.weta.ch/cgi-bin/mjpg/video.cgi?channel=0&subtype=1"
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571587874.avi"
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571763260.avi"
video_source = "test_data/reversed.avi"

# video_source = "videos/2025-11-20_05-55-30.mp4" ## Ausfahrt Gleis. 1 -> Chur

window_normal = "Normal"
window_diff   = "Difference"

snippet_duration = 10.0

debug_mode = True
output_video = True or not debug_mode


@dataclass
class Area:
    points: list[tuple[float, float]]
    trigger_threshold: int
    trigger_duration: float

    current_trigger_timer: float = 0.0

    mask_image: np.typing.NDArray[np.uint8] = None
    computed_points: np.typing.NDArray[np.int32] = None

    def compute(self, width: int, height: int):
        self.computed_points = np.array([[np.int32(point[0] * width), np.int32(point[1] * height)] for point in self.points], np.int32)
        self.computed_points = self.computed_points.reshape((-1,1,2))

        self.mask_image = np.zeros((height,width,3), np.uint8)
        cv2.fillPoly(self.mask_image, [self.computed_points], color=(255, 255, 255))


scan_areas = [
    ## Bahnsteig Richtung St. Moritz (Gleis 1-3)
    Area(
        points=[(0.85, 1.0), (1.0, 1.0), (1.0, 0.69), (0.75, 0.60), (0.64, 0.75)],
        trigger_threshold=10000,
        trigger_duration=1.0,
    ),

    ## Bahnsteig Richtung Chur (Gleis 2)
    Area(
        points=[(0.77, 0.67), (0.68, 0.67), (0.50, 0.55), (0.54, 0.55)],
        trigger_threshold=1000,
        trigger_duration=3.0,
    ),

    ## Bahnsteig Richtung Chur (Gleis 1)
    Area(
        points=[(0.64, 0.75), (0.50, 0.60), (0.50, 0.55), (0.68, 0.67)],
        trigger_threshold=1000,
        trigger_duration=3.0,
    ),
]


@dataclass 
class SnippetCollection:
    previous_file: str = None
    current_file: str = None

    target_file: str = None

    recording: bool = False
    wait_for_last: bool = False
    segments: list[str] = None
    removal_queue: list[str] = None

    def __post_init__(self):
        self.segments = []
        self.removal_queue = []

    def start_recording(self):
        print(f"== Started Recording at {datetime.now()} ==")
        if len(self.segments) == 0:
            if not self.previous_file:
                self.segments = [self.current_file]
            else:
                self.segments = [self.previous_file, self.current_file]
        self.recording = True
        self.wait_for_last = False
        self.target_file = f"videos/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.mp4"

    def stop_recording(self):
        print(f"== Stopped Recording at {datetime.now()} ==")
        self.recording = False
        self.wait_for_last = True


    def next_snippet(self, file):
        print(f" -> {file}")
        if not output_video:
            return

        self.previous_file = self.current_file
        self.current_file = file
        self.removal_queue.append(file)

        if self.recording:
            self.segments.append(file)
        elif self.wait_for_last:
            self.segments.append(file)
            self.wait_for_last = False
        elif len(self.segments) != 0:
            self.flush()
        elif len(self.removal_queue) > 15:
            while len(self.removal_queue) > 5:
                queued_file = self.removal_queue.pop(0)
                print(f"* Cleaned {queued_file}")
                os.remove(queued_file)
    
    def flush(self):
        if not output_video:
            return

        ## Create file list
        filelist = f"flush_files.txt"
        with open(filelist, "w") as f:
            for segment in self.segments:
                f.write(f"file '{segment}'\n")

        process = subprocess.Popen([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "concat",
            "-i", filelist,
            "-c:v", "copy", self.target_file
        ])
        process.wait()

        print(f" => {self.target_file}  ({len(self.segments)} segments)")
        self.segments = []

class FFmpegVideoWriter:
    def __init__(self, filepath: str, width: int, height: int, fps: int):
        if not output_video:
            return

        self.process = subprocess.Popen([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "rawvideo", "-r", str(fps), "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-i", "pipe:0",
            "-f", "mpegts", "-c:v", "h264", "-crf", "22", "-pix_fmt", "yuv420p", filepath
        ], stdin=subprocess.PIPE)

    def write(self, image: np.typing.NDArray[np.uint8]):
        if not output_video:
            return

        self.process.stdin.write(image.tobytes())

    def release(self):
        if not output_video:
            return

        self.process.stdin.close()
        self.process.wait()


def run_capture(collection: SnippetCollection):
    capture = cv2.VideoCapture(video_source)
    writer = None

    fail_count = 0
    snippet_count = 0

    src_width = None
    src_height = None
    src_deltatime = None

    prev_image = None

    while True:
        ## Capture current
        ret, curr_image = capture.read()
        if not ret or curr_image is None:
            # Attempt 100 times
            fail_count += 1
            if fail_count > 100:
                print("Capture failed due to unknown reasons")
                capture.release()
                return
            continue
        else:
            # Slowly return to zero
            fail_count = max(0, fail_count - 1)

        ## Extract metadata
        if src_width is None:
            src_width  = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            src_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            src_fps = capture.get(cv2.CAP_PROP_FPS) / 2
            src_deltatime = 1.0 / src_fps

            for area in scan_areas:
                area.compute(src_width, src_height)

        ## Setup output writer for current snippet
        if writer is None or snippet_count*src_deltatime > snippet_duration:
            if writer:
                writer.release()

            filepath = f"snippets/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.mts"
            writer = FFmpegVideoWriter(filepath, src_width, src_height, src_fps)
            snippet_count = 0
            collection.next_snippet(filepath)

        writer.write(curr_image)
        snippet_count += 1

        ## Detect difference
        if prev_image is None:
            prev_image = curr_image
            continue

        image_diff = cv2.absdiff(prev_image, curr_image)
        image_diff[image_diff < 50] = 0
        prev_image = curr_image

        # Copy to avoid messing with difference
        if debug_mode:
            curr_image = curr_image.copy()

        ## Analyse areas
        any_active = False
        for area in scan_areas:
            area_diff = cv2.bitwise_and(image_diff, area.mask_image)

            area_sum = np.sum(area_diff)
            area_triggered = area_sum >= area.trigger_threshold

            if area_triggered:
                area.current_trigger_timer = min(area.trigger_duration * 2.0, area.current_trigger_timer + src_deltatime)
            else:
                area.current_trigger_timer = max(0.0, area.current_trigger_timer - src_deltatime)

            if area.current_trigger_timer > area.trigger_duration:
                any_active = True

            # print(f"Area Sum: {area_sum} => {area_triggered} || {area.current_trigger_timer}")

            if debug_mode:
                color = (0, 255, 0) if area.current_trigger_timer > area.trigger_duration else ((0, 0, 255) if area_triggered else (255, 0, 0))
                cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=color, thickness=5)
        
        if any_active and not collection.recording:
            collection.start_recording()
        elif not any_active and collection.recording:
            collection.stop_recording()

        ## Show window
        if debug_mode:
            cv2.imshow(window_normal, curr_image)
            cv2.imshow(window_diff, image_diff)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)


def main():
    if debug_mode:
        cv2.namedWindow(window_diff, cv2.WINDOW_NORMAL)
        cv2.namedWindow(window_normal, cv2.WINDOW_NORMAL)
    
    collection = SnippetCollection()

    # while True:
    if True:
        print(f"Attemping capture on {datetime.now()}")
        try:
            run_capture(collection)
        except Exception as e:
            print(f"Unexpected exception: {e}")

if __name__ == "__main__":
    main()
