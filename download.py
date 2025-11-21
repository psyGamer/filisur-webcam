import os
import sys
import subprocess
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

import numpy as np
import cv2
import util

webcam_url = "https://grischuna-cam.weta.ch/cgi-bin/mjpg/video.cgi?channel=0&subtype=1"

video_source = webcam_url
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571587874.avi"
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571763260.avi"
# video_source = "test_data/reversed.avi"

# video_source = "videos/2025-11-20_05-55-30.mp4" ## Ausfahrt Gleis. 1 -> Chur

## False Positives
video_source = "false_positive/2025-11-21_00-16-05.mp4"
video_source = "false_positive/2025-11-20_18-56-16.mp4"
video_source = "false_positive/2025-11-21_00-21-12.mp4"
video_source = "false_positive/2025-11-21_01-08-03.mp4"
video_source = "false_positive/2025-11-21_02-57-40.mp4"
video_source = "false_positive/2025-11-21_03-20-12.mp4"
video_source = "false_positive/2025-11-21_03-04-08.mp4"

## Real Trains
video_source = "real_videos/2025-11-21_05-54-56.mp4"
# video_source = "real_videos/2025-11-21_06-14-23.mp4"
# video_source = "real_videos/2025-11-21_07-59-24.mp4"
# video_source = "real_videos/2025-11-21_08-01-08.mp4"

## Tests
# video_source = "test_data/showdown_17.avi"
# video_source = "test_data/night_switch.mts"

window_normal = "Normal"
window_diff   = "Difference"

snippet_duration = 10.0
check_interval = 1.0
night_check_interval = 300.0
minimum_recording_duration = 3.0

weather_check_area_pt1 = (0.25, 0.17)
weather_check_area_pt2 = (0.75, 0.48)

debug_mode = True
output_video = video_source == webcam_url or not debug_mode

class DayMode(Enum):
    BOTH = 0
    DAY = 1
    NIGHT = 2

@dataclass
class Area:
    points: list[tuple[float, float]]
    trigger_threshold: int
    trigger_area_percentage: float

    mode: DayMode = DayMode.BOTH
    max_weather_noise: int = 2**64
    skip_start_buffer: bool = False

    mask_image: np.typing.NDArray[np.uint8] = None
    mask_percentage: float = 0.0
    mask_area: int = 0

    computed_points: np.typing.NDArray[np.int32] = None
    
    average_area_sum: float = None

    def compute(self, width: int, height: int):
        self.computed_points = np.array([[np.int32(point[0] * width), np.int32(point[1] * height)] for point in self.points], np.int32)
        self.computed_points = self.computed_points.reshape((-1,1,2))

        self.mask_image = np.zeros((height,width,3), np.uint8)
        cv2.fillPoly(self.mask_image, [self.computed_points], color=(255, 255, 255))

        self.mask_area = np.count_nonzero(self.mask_image)

        # print(width*height, np.sum(self.mask_image == (255, 255, 255)), (full_mask == (255, 255, 255)).sum())
        # self.mask_percentage = np.sum(cv2.bitwise_and(self.mask_image, full_mask) == (255, 255, 255)) / np.sum(full_mask == (255, 255, 255))
        self.mask_percentage = 1


    def trigger_check(self, image_diff: np.typing.NDArray, diff_sum: float, update: bool) -> bool:
        area_diff = cv2.bitwise_and(image_diff, self.mask_image)
        area_sum = np.sum(area_diff)

        if update:
            if self.average_area_sum is None:
                self.average_area_sum = area_sum
            else:
                alpha = 0.1
                self.average_area_sum = (1.0 - alpha)*self.average_area_sum + alpha*area_sum

            # print(f"- {area_sum}/{self.trigger_threshold}  ({self.average_area_sum} // {abs(self.average_area_sum - area_sum)})  =>  {area_sum/diff_sum*100}% // {self.mask_percentage*100}%")
            # print(f"- {area_sum}/{self.trigger_threshold} ({area_sum/self.trigger_threshold*100:.2f}%) // {np.count_nonzero(area_diff)}/{self.mask_area} ({np.count_nonzero(area_diff)/self.mask_area*100:.2f}%)  ==>  {area_sum * (np.count_nonzero(area_diff)/self.mask_area):.0f}")

        return area_sum >= self.trigger_threshold and np.count_nonzero(area_diff)/self.mask_area >= self.trigger_area_percentage
        # return area_sum >= self.trigger_threshold and area_sum/diff_sum >= self.mask_percentage*0.9

scan_areas = [
    ## Bahnsteig Richtung St. Moritz (Gleis 1-3)
    # Area(
    #     points=[(0.85, 1.0), (1.0, 1.0), (1.0, 0.69), (0.75, 0.60), (0.64, 0.75)],
    #     trigger_threshold=200_000,
    #     trigger_area_percentage=1.0,
    # ),

    # ## Bahnsteig Richtung Chur (Gleis 2)
    # Area(
    #     points=[(0.77, 0.67), (0.68, 0.67), (0.49, 0.55), (0.54, 0.55)],
    #     trigger_threshold=100_000,
    #     trigger_area_percentage=0.1,
    # ),

    # ## TODO: Erkennt bei Nacht (und vllt. auch Tag) schlecht langsame Züge
    # ## Bahnsteig Richtung Chur (Gleis 1)
    # Area(
    #     points=[(0.64, 0.75), (0.50, 0.60), (0.50, 0.55), (0.68, 0.67)],
    #     trigger_threshold=30_000, #20_000
    #     trigger_area_percentage=1.0,
    # ),

    ## Gleis 1 (Edge)
    Area(
        points=[(0.50, 0.60), (0.50, 0.62), (0.82, 1.0), (0.86, 1.0)],
        trigger_threshold=70_000,
        trigger_area_percentage=0.15,
        mode=DayMode.NIGHT
    ),
    ## Gleis 2 (Edge)
    Area(
        points=[(0.56, 0.63), (0.56, 0.65), (1.0, 0.99), (1.0, 0.97)],
        trigger_threshold=50_000,
        trigger_area_percentage=0.1,
    ),

    # Area(
    #     points=[(0.78, 0.67), (0.68, 0.67), (0.49, 0.55), (0.54, 0.55)],
    #     trigger_threshold=120_000,
    #     trigger_area_percentage=0.2,
    # ),

    ## Bahnsteig Gleis 2 (Top - Richtung Chur)
    Area(
        points=[(0.64, 0.59), (0.57, 0.59), (0.49, 0.55), (0.54, 0.55)],
        trigger_threshold=45_000,
        trigger_area_percentage=0.30,
        max_weather_noise=1_000_000,
    ),
    ## Bahnsteig Gleis 2 (Top - Mitte)
    Area(
        points=[(0.68, 0.67), (0.78, 0.67), (0.64, 0.59), (0.57, 0.59)],
        trigger_threshold=80_000,
        trigger_area_percentage=0.2,
        max_weather_noise=1_000_000,
    ),
    ## Bahnsteig Gleis 2 (Top - Richtung St. Moritz)
    Area(
        points=[(0.78, 0.67), (0.68, 0.67), (1.0, 0.83), (1.0, 0.73)],
        trigger_threshold=100_000,
        trigger_area_percentage=0.1,
    ),

    ## Bahnsteig Gleis 1+2 (Floor - Richtung St. Moritz)
    Area(
        points=[(0.81, 0.94), (0.87, 1.0), (1.0, 1.0), (1.0, 0.92), (0.92, 0.87)],
        trigger_threshold=400_000,
        trigger_area_percentage=0.3,
        skip_start_buffer=True
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

    start_time: float = 0.0

    def __post_init__(self):
        self.segments = []
        self.removal_queue = []

    def start_recording(self, time: float, skip_start_buffer: bool):
        print(f"== Started Recording at {datetime.now()} ==")
        if len(self.segments) == 0:
            if skip_start_buffer or not self.previous_file:
                self.segments = [self.current_file]
            else:
                self.segments = [self.previous_file, self.current_file]
        self.recording = True
        self.wait_for_last = False
        self.target_file = f"videos/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.mp4"
        self.start_time = time

    def stop_recording(self, time: float):
        if time - self.start_time < minimum_recording_duration:
            print(f"== Cancelled Recording at {datetime.now()} ==")
            self.recording = False
            self.segments = []
            return
            
        print(f"== Stopped Recording at {datetime.now()} ==")
        self.recording = False
        self.wait_for_last = True


    def next_snippet(self, file: str):
        print(f" -> {file}")

        self.previous_file = self.current_file
        self.current_file = file

        if output_video:
            self.removal_queue.append(file)

        if self.recording:
            self.segments.append(file)
        elif self.wait_for_last:
            self.segments.append(file)
            self.wait_for_last = False
        elif len(self.segments) != 0:
            self.flush()
        elif len(self.removal_queue) > 180 and output_video:
            while len(self.removal_queue) > 60:
                queued_file = self.removal_queue.pop(0)
                print(f"* Cleaned {queued_file}")
                # os.remove(queued_file)
    
    def flush(self):
        if not output_video:
            print(f" => {self.target_file}  ({len(self.segments)} segments)")
            self.segments = []
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

    total_count = 0

    fail_count = 0
    snippet_count = 0

    check_counter = 0
    check_time = 0

    night_check_counter = 0
    night_check_time = 0
    is_night = None

    src_width = None
    src_height = None
    src_deltatime = None

    weather_mask = None

    prev_image = None
    prev_accum = None

    ## Debug controls
    auto_playback = True
    auto_pause = True

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
        
        total_count += 1

        ## Extract metadata
        if src_width is None:
            src_width  = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            src_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            src_fps = capture.get(cv2.CAP_PROP_FPS) / 2
            src_deltatime = 1.0 / src_fps

            weather_mask = np.zeros((src_height,src_width,3), np.uint8)
            cv2.rectangle(weather_mask, 
                          pt1=(int(weather_check_area_pt1[0]*src_width), int(weather_check_area_pt1[1]*src_height)), 
                          pt2=(int(weather_check_area_pt2[0]*src_width), int(weather_check_area_pt2[1]*src_height)), 
                          thickness=-1, color=(255, 255, 255))

            check_time = int(check_interval * src_fps)
            night_check_time = int(night_check_interval * src_fps)

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

        # if prev_accum is None:
        #     prev_accum = curr_image.copy()

        # alpha = 0.01
        # prev_accum = (prev_accum*(1 - alpha) + curr_image*alpha).astype(np.uint8)

        if check_counter > 0:
            check_counter -= 1

            if not debug_mode:
                continue

            image_diff = cv2.absdiff(prev_image, curr_image)
            image_diff[image_diff < 50] = 0

            diff_sum = np.sum(image_diff)

            # for area in scan_areas:
            #     if debug_mode:
            #         color = (0, 255, 0) if area.trigger_check(image_diff, diff_sum) else (255, 0, 0)
            #         cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=color, thickness=5)

            # cv2.imshow(window_normal, curr_image)
            # cv2.waitKey(1)
            # cv2.waitKey(1)
            # cv2.waitKey(1)
            # cv2.waitKey(1)
            # cv2.waitKey(1)
            continue
        else:
            check_counter = check_time
            # while cv2.waitKey(1) != 27:
            #     pass

        ## Detect difference
        if prev_image is None:
            prev_image = curr_image
            # prev_accum = np.empty(np.shape(curr_image))
            continue

        # cv2.accumulateWeighted(curr_image, prev_accum, alpha=0.1)
        

        image_diff = cv2.absdiff(prev_image, curr_image)
        image_diff[image_diff < 15] = 0
        prev_image = curr_image

        # cv2.accumulateWeighted(image_diff, prev_accum, alpha=0.1)

        # accum_diff = cv2.absdiff(prev_accum, curr_image)
        # accum_diff[image_diff < 50] = 0

        diff_sum = np.sum(image_diff)
        weather_sum = np.sum(cv2.bitwise_and(image_diff, weather_mask))
        # print(diff_sum, weather_sum)

        # Check for night-vision
        if night_check_counter <= 0 or diff_sum >= 50_000_000:
            night_check_counter = night_check_time

            r_sum = int(np.sum(curr_image[:,:,2]))
            g_sum = int(np.sum(curr_image[:,:,1]))
            b_sum = int(np.sum(curr_image[:,:,0]))

            # With night-vision active, these differences are very constant
            is_night = abs(r_sum - g_sum) < 1_000_000 and abs(r_sum - b_sum) < 500_000 and abs(b_sum - g_sum) < 1_500_000
        else:
            night_check_counter -= 1

        # Copy to avoid messing with difference
        if debug_mode:
            curr_image = curr_image.copy()

        dbg = image_diff.copy()

        ## Analyse areas
        any_active = False
        should_skip_start_buffer = False
        # print("===")
        for area in scan_areas:
            if weather_sum >= area.max_weather_noise or (is_night and area.mode == DayMode.DAY) or (not is_night and area.mode == DayMode.NIGHT):
                if debug_mode:
                    cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=(0, 0, 255), thickness=2)
                    cv2.polylines(dbg, [area.computed_points], isClosed=True, color=(0, 0, 255), thickness=2)
                continue

            area_triggered = area.trigger_check(image_diff, diff_sum, update=True)

            if area_triggered:
                any_active = True
                should_skip_start_buffer = should_skip_start_buffer or area.skip_start_buffer

            if debug_mode:
                color = (0, 255, 0) if area_triggered else (255, 0, 0)
                cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=color, thickness=2)
                cv2.polylines(dbg, [area.computed_points], isClosed=True, color=color, thickness=2)
        
        if any_active and not collection.recording:
            if auto_pause:
                auto_playback = False

            collection.start_recording(total_count*src_deltatime, should_skip_start_buffer)
        elif not any_active and collection.recording:
            collection.stop_recording(total_count*src_deltatime)

        ## Show window
        if debug_mode:
            cv2.imshow(window_normal, curr_image)
            cv2.imshow(window_diff, dbg)
            match cv2.waitKey(1):
                case 112: # 'p'
                    auto_playback = not auto_playback
                case 97: # 'a'
                    auto_pause = not auto_pause
            if not auto_playback:
                while True:
                    match cv2.waitKey(1):
                        case 112: # 'p'
                            auto_playback = True
                            break
                        case 27: # ESC
                            break

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
