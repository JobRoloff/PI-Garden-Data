from pathlib import Path
from typing import Optional

from pathlib import Path


def listRawData(path: Optional[Path] = None):
    output = []
    p = Path(path) if path else (Path.cwd()/"data"/"raw")

    # Iterate over all items in the directory and check if each item is a file
    for file_path in p.iterdir():
        if file_path.is_file():
            # Open and read the file's content
            with file_path.open('r', encoding='utf-8') as f:
                content = f.read()
                output.append(content)
    return output

if __name__ == "__main__":
    print("running main")
    rd = listRawData("./raw")
    print(rd)