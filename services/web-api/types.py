from dataclasses import dataclass

@dataclass
class Event:
    ts: str
    topic: str
    report_ts: float
    series: dict[str, float]
    actuators: dict
    sensor_id: str
    timestamp: float
    sensor_type: str