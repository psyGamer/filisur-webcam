import os
import rich
import rich.markup
from dataclasses import dataclass

import download


@dataclass 
class TestingSnippetCollection:
    expected_spans: list[tuple[float, float]]
    actual_spans: list[tuple[float, float]] = None

    recording: bool = False
    start_time: float = 0.0

    def __post_init__(self):
        self.actual_spans = []

    def start_recording(self, time: float):
        self.recording = True
        self.start_time = time

    def stop_recording(self, time: float):
        self.recording = False

        if time - self.start_time >= download.minimum_recording_duration:
            self.actual_spans.append((self.start_time, time))


    def next_snippet(self, file: str):
        pass


def main():
    download.output_video = False
    download.debug_mode = False

    ## Check false positives
    for file in os.listdir("false_positive"):
        collection = TestingSnippetCollection([])

        download.video_source = f"false_positive/{file}"
        download.run_capture(collection)

        if len(collection.actual_spans) != 0 or collection.recording:
            rich.print(f"[bold red]✕ FAILED[/bold red] [red]{rich.markup.escape(file)}")
        else:
            rich.print(f"[bold green]✓ PASSED[/bold green] [green]{rich.markup.escape(file)}")

if __name__ == "__main__":
    main()