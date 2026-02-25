## Getting started

Pull docker images / startup the project's containers

```bash
docker compose up -d
```

(Optional but insightful) View container logs

```bash
docker compose logs -f mosquitto timescaledb <any other container names you wish to view logs>
```

From the terminal of the container, watch mqtt messages

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'test/topic' -v
```

From a different device on your wifi network, publish a message to the broker which the subsriber is listening to

```bash
mosquitto_pub -h <1.9.168.1.[ip of computer running the container]> -p 1883 -t '<topic>' -m {"from": "device2"}
```

## Data Stuff

Data is stored via volume on the computer running the docker container.

view the data by doing the following in a terminal:

Use psql inside the db container

```bash
docker compose exec timescaledb psql -U postgres -d app
```

run up some sql commands

```sql
SELECT * FROM mqtt_messages ORDER BY ts DESC LIMIT 20;
```

## Networking Stuff

Given:

- Docker runs: MQTT Broker && an Internal Subscriber on my home computer
- Separate devices such as the Raspberr Pi Sensor Scripts (on the same wifi network) need to publish to the broker

Terms:

- Localhost
- Lan
- Docker Network

local host is the same machine and network namespace. For example, on your computer, localhost:1883 is a precess on the same computer.

Lan is your private wifi network where devices could ttalk directly to each other via a private IP. So your devices like phone and computer is on your LAN. Docker containers are NOT on lan by default. By default, they live in a docker network behind the computer running it. The implication of this is that when or edge devices want to publish to our broker thatt's running within a docker container, the publisher need to access the broker via the container's LAN. But before doing tthis, the Docker container need tto be set up such that the conttainer has ports exposed.

Docker Network is a private virttual network that only containers on the Compose stack an see. In tthe context of this project, the different services we're using called "mosquitto" and "timescaledb" could reach each other because they're on the same network sitting behind Docker. External devices cannot directly reach tthese containers since they aren't sitting on the same network.