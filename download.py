import os
import subprocess
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

import numpy as np
import cv2

webcam_url = "https://grischuna-cam.weta.ch/cgi-bin/mjpg/video.cgi?channel=0&subtype=1"

video_source = webcam_url
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571587874.avi"
# video_source = "test_data/showdown_17_19-11-cut-merged-1763571763260.avi"
# video_source = "test_data/reversed.avi"

# video_source = "videos/2025-11-20_05-55-30.mp4" ## Ausfahrt Gleis. 1 -> Chur

## False Positives
# video_source = "false_positive/2025-11-21_00-16-05.mp4"
# video_source = "false_positive/2025-11-20_18-56-16.mp4"
# video_source = "false_positive/2025-11-21_00-21-12.mp4"
# video_source = "false_positive/2025-11-21_01-08-03.mp4"
# video_source = "false_positive/2025-11-21_02-57-40.mp4"
# video_source = "false_positive/2025-11-21_03-20-12.mp4"
# video_source = "false_positive/2025-11-21_04-15-11.mp4"

## False Negative
# video_source = "false_negative/2025-11-21_22-02-10.mts"

## Real Trains
# video_source = "real_videos/2025-11-21_05-54-56.mp4"
# video_source = "real_videos/2025-11-21_06-14-23.mp4"
# video_source = "real_videos/2025-11-21_07-59-24.mp4"
# video_source = "real_videos/2025-11-21_08-01-08.mp4"

## Tests
# video_source = "test_data/showdown_18.avi"
# video_source = "test_data/night_switch.mts"

# video_source = "videos/2025-11-22_11-58-36.mp4"
# video_source = "videos/2025-11-22_12-04-22.mp4"
# video_source = "real_videos/2025-11-20_22-03-13.mts"
# video_source = "real_videos/2025-11-21_23-05-20.mp4"
# video_source = "videos/2025-11-22_13-58-49.mp4"

window_normal = "Normal"
window_diff   = "Difference"

snippet_duration = 10.0
check_interval = 1.0
night_check_interval = 300.0
minimum_recording_duration = 3.0

weather_check_area_pt1 = (0.25, 0.17)
weather_check_area_pt2 = (0.75, 0.48)

last_image_write = None

debug_mode = False
debug_log = False
output_video = video_source == webcam_url or not debug_mode

class DayMode(Enum):
    BOTH = 0
    DAY = 1
    NIGHT = 2

@dataclass
class Condition:
    threshold: int
    area_percent: float

    max_weather_noise: int = 2**64
    max_sky_light: int = 2**64

@dataclass
class Area:
    points: list[tuple[float, float]]
    triggers: list[Condition]

    mode: DayMode = DayMode.BOTH
    skip_start_buffer: bool = False

    mask_image: np.typing.NDArray[np.uint8] = None
    mask_area: int = 0

    computed_points: np.typing.NDArray[np.int32] = None

    def compute(self, width: int, height: int):
        self.computed_points = np.array([[np.int32(point[0] * width), np.int32(point[1] * height)] for point in self.points], np.int32)
        self.computed_points = self.computed_points.reshape((-1,1,2))

        self.mask_image = np.zeros((height,width,3), np.uint8)
        cv2.fillPoly(self.mask_image, [self.computed_points], color=(255, 255, 255))

        self.mask_area = np.count_nonzero(self.mask_image)


    def trigger_check(self, image_diff: np.typing.NDArray, weather_noise: float, sky_light: float, update: bool) -> bool:
        area_diff = cv2.bitwise_and(image_diff, self.mask_image)
        area_sum = np.sum(area_diff)

        for condition in self.triggers:
            if weather_noise > condition.max_weather_noise or sky_light > condition.max_sky_light:
                continue

            if debug_log and update:
                print(f"- {area_sum}/{condition.threshold} ({area_sum/condition.threshold*100:.2f}%) // {np.count_nonzero(area_diff)}/{self.mask_area} ({np.count_nonzero(area_diff)/self.mask_area*100:.2f}%)  ==>  {area_sum * (np.count_nonzero(area_diff)/self.mask_area):.0f}")

            return area_sum >= condition.threshold and np.count_nonzero(area_diff)/self.mask_area >= condition.area_percent

        if debug_log and update:
            print(f"- DISABLED: {area_sum} // {np.count_nonzero(area_diff)}/{self.mask_area} ({np.count_nonzero(area_diff)/self.mask_area*100:.2f}%)  ==>  {area_sum * (np.count_nonzero(area_diff)/self.mask_area):.0f}")

        return False

scan_areas = [
    ## Gleis 1 (Edge)
    Area(
        points=[(0.50, 0.60), (0.50, 0.62), (0.67, 0.82), (0.67, 0.78)],
        triggers=[
            Condition(threshold=15_000, area_percent=0.10, max_weather_noise=50_000, max_sky_light=20_000_000),
            Condition(threshold=35_000, area_percent=0.15, max_weather_noise=750_000),
            Condition(threshold=50_000, area_percent=0.20, max_weather_noise=900_000),
            Condition(threshold=75_000, area_percent=0.30),
        ],
    ),
    ## Gleis 2 (Edge)
    Area(
        points=[(0.56, 0.63), (0.56, 0.65), (0.67, 0.73), (0.67, 0.71)],
        triggers=[
            Condition(threshold=5_000, area_percent=0.05, max_weather_noise=10_000, max_sky_light=20_000_000),
            Condition(threshold=25_000, area_percent=0.05, max_weather_noise=50_000),
            Condition(threshold=50_000, area_percent=0.1),
        ],
        skip_start_buffer=True,
    ),

    ## Bahnsteig Gleis 2 (Top - Richtung Chur)
    Area(
        points=[(0.61, 0.59), (0.55, 0.59), (0.50, 0.56), (0.535, 0.56)],
        triggers=[
            Condition(threshold=5_000, area_percent=0.05, max_weather_noise=10_000, max_sky_light=20_000_000),
            Condition(threshold=20_000, area_percent=0.15, max_weather_noise=50_000),
            Condition(threshold=45_000, area_percent=0.3, max_weather_noise=1_000_000),
        ],
    ),
    ## Bahnsteig Gleis 2 (Top - Mitte)
    Area(
        points=[(0.69, 0.67), (0.79, 0.67), (0.61, 0.59), (0.55, 0.59)],
        triggers=[
            Condition(threshold=10_000, area_percent=0.05, max_weather_noise=10_000, max_sky_light=20_000_000),
            Condition(threshold=20_000, area_percent=0.1, max_weather_noise=50_000),
            Condition(threshold=80_000, area_percent=0.2, max_weather_noise=1_000_000),
        ],
    ),
    ## Bahnsteig Gleis 2 (Top - Richtung St. Moritz)
    Area(
        points=[(0.79, 0.67), (0.69, 0.67), (1.0, 0.83), (1.0, 0.73)],
        triggers=[
            Condition(threshold=100_000, area_percent=0.1)
        ],
        skip_start_buffer=True,
    ),

    ## Bahnsteig Gleis 1+2 (Floor - Richtung St. Moritz)
    Area(
        points=[(0.68, 0.80), (0.87, 1.0), (1.0, 1.0), (1.0, 0.92), (0.68, 0.71)],
        triggers=[
            Condition(threshold=100_000, area_percent=0.05)
        ],
        skip_start_buffer=True
    ),
    ## Bahnsteig Gleis 1+2 (Side - Richtung Chur)
    Area(
        points=[(0.50, 0.56), (0.50, 0.62), (0.54, 0.66), (0.54, 0.59)],
        triggers=[
            Condition(threshold=15_000, area_percent=0.1, max_weather_noise=5_000, max_sky_light=20_000_000),
            Condition(threshold=20_000, area_percent=0.2, max_weather_noise=300_000),
        ],
        skip_start_buffer=True,
    ),
]


@dataclass 
class SnippetCollection:
    previous_file: str = None
    current_file: str = None

    target_file: str = None

    recording: bool = False
    segments: list[str] = None
    removal_queue: list[str] = None

    start_time: float = 0.0

    def __post_init__(self):
        self.segments = []
        self.removal_queue = []

    def start_recording(self, time: float, skip_start_buffer: bool):
        print(f"== Started Recording at {datetime.now()} ==")
        if len(self.segments) == 0:
            if True or skip_start_buffer or not self.previous_file:
                self.segments = [self.current_file]
            else:
                self.segments = [self.previous_file, self.current_file]

            self.target_file = f"videos/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.mp4"
            self.start_time = time

        self.recording = True

    def stop_recording(self, time: float):
        if time - self.start_time < minimum_recording_duration:
            print(f"== Cancelled Recording at {datetime.now()} ==")
            self.recording = False
            self.segments = []
            return
            
        print(f"== Stopped Recording at {datetime.now()} ==")
        self.recording = False


    def next_snippet(self, file: str):
        print(f" -> {file}")

        self.previous_file = self.current_file
        self.current_file = file

        if output_video:
            self.removal_queue.append(file)

        if self.recording:
            self.segments.append(file)
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

    ## Debug controls
    auto_playback = True
    auto_pause = False
    auto_fastforward = False

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

            now = datetime.now()
            hourly_now = now.replace(minute=0, second=0, microsecond=0)
            global last_image_write
            if output_video and (last_image_write is None or last_image_write != hourly_now):
                last_image_write = hourly_now
                cv2.imwrite(f"images/{now.strftime('%Y-%m-%d_%H-%M-%S')}.png", curr_image)

            filepath = f"snippets/{now.strftime('%Y-%m-%d_%H-%M-%S')}.mts"
            writer = FFmpegVideoWriter(filepath, src_width, src_height, src_fps)
            snippet_count = 0
            collection.next_snippet(filepath)

        writer.write(curr_image)
        snippet_count += 1

        if check_counter > 0:
            check_counter -= 1

            if not debug_mode or (auto_fastforward and auto_playback):
                continue

            image_diff = cv2.absdiff(prev_image, curr_image)
            image_diff[image_diff < 50] = 0

            diff_sum = np.sum(image_diff)
            weather_sum = np.sum(cv2.bitwise_and(image_diff, weather_mask))
            sky_sum = np.sum(cv2.bitwise_and(curr_image, weather_mask))

            for area in scan_areas:
                if (is_night and area.mode == DayMode.DAY) or (not is_night and area.mode == DayMode.NIGHT):
                    cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=(0, 0, 255), thickness=2)
                else:
                    color = (0, 255, 0) if area.trigger_check(image_diff, weather_sum, sky_sum, update=False) else (255, 0, 0)  
                    cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=color, thickness=2)

            cv2.imshow(window_normal, curr_image)
            match cv2.waitKey(1):
                case 112: # 'p'
                    auto_playback = not auto_playback
                    print(f"Toggled auto-playback to {auto_playback}")
                case 97: # 'a'
                    auto_pause = not auto_pause
                    auto_fastforward = False
                    print(f"Toggled auto-pause to {auto_pause}")
                case 102: # 'f'
                    auto_fastforward = not auto_fastforward
                    auto_pause = True
                    print(f"Toggled auto-fastforward to {auto_fastforward}")

            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            cv2.waitKey(1)
            continue
        else:
            check_counter = check_time

        ## Detect difference
        if prev_image is None:
            prev_image = curr_image
            continue

        image_diff = cv2.absdiff(prev_image, curr_image)
        image_diff[image_diff < 20] = 0
        prev_image = curr_image

        diff_sum = np.sum(image_diff)
        weather_sum = np.sum(cv2.bitwise_and(image_diff, weather_mask))
        sky_sum = np.sum(cv2.bitwise_and(curr_image, weather_mask))

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

        if debug_log:
            print(f"=== {diff_sum} // {weather_sum} // {sky_sum} ===")

        ## Analyse areas
        any_active = False
        should_skip_start_buffer = False
        for area in scan_areas:
            if (is_night and area.mode == DayMode.DAY) or (not is_night and area.mode == DayMode.NIGHT):
                if debug_mode:
                    cv2.polylines(curr_image, [area.computed_points], isClosed=True, color=(0, 0, 255), thickness=2)
                    cv2.polylines(dbg, [area.computed_points], isClosed=True, color=(0, 0, 255), thickness=2)
                continue

            area_triggered = area.trigger_check(image_diff, weather_sum, sky_sum, update=True)

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
            if auto_fastforward and auto_playback:
                continue

            cv2.imshow(window_normal, curr_image)
            cv2.imshow(window_diff, dbg)

            match cv2.waitKey(1):
                case 112: # 'p'
                    auto_playback = not auto_playback
                    print(f"Toggled auto-playback to {auto_playback}")
                case 97: # 'a'
                    auto_pause = not auto_pause
                    auto_fastforward = False
                    print(f"Toggled auto-pause to {auto_pause}")
                case 102: # 'f'
                    auto_fastforward = not auto_fastforward
                    auto_pause = True
                    print(f"Toggled auto-fastforward to {auto_fastforward}")
            if not auto_playback:
                while True:
                    match cv2.waitKey(1):
                        case 112: # 'p'
                            auto_playback = True
                            print(f"Toggled auto-playback to {auto_playback}")
                            break
                        case 97: # 'a'
                            auto_pause = not auto_pause
                            auto_fastforward = False
                            print(f"Toggled auto-pause to {auto_pause}")
                        case 102: # 'f'
                            auto_fastforward = not auto_fastforward
                            auto_pause = True
                            print(f"Toggled auto-fastforward to {auto_fastforward}")
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

    while True:
    # if True:
        print(f"Attemping capture on {datetime.now()}")
        try:
            run_capture(collection)
        except Exception as e:
            print(f"Unexpected exception: {e}")

if __name__ == "__main__":
    main()
