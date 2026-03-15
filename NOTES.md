## Data Driven Gardening Questions

Garden Control:
- I'd imagine there sometimes being environmental fluctuations in the greenhouse when you do something such as open the door / vents when its cold outside. How good is my system at maintining homeostasis of a given environment?
- Imagine being able to just buy a plant and have a greenhouse create the best environment for it. How might I setup environmental "profiles" for a user to configure to replicate different climates?

Product:
- How might recommend different users new plants which would fit in well with their current environment? Would this look like local gardeners swapping plants or even recommending plants from something such as a search in a knowledge base and some api calls to local garden plant suppliers?
- Aside from doubling as my cs312 individual semester project, why would anyone want a web ui? Even if there were capabilities to do all of the mentioned questtions to answer, wouldn't the typical greenhouse gardener prefer texts, emails, an esp32 oled display over a web ui?
    - A web ui might be useful for business applications rather than typical consumers. For example, businesses would need to do things like inventory management, sales, and interface with customers.
    - If I were to sell plants from my mini greenhouse, how would I want my ui to help me?
        - Enable some way to label data so that my garden has its own ml prediction model: health outcomes, yield, yield quality
        - Message past customers of an upcoming harvest
        - share a visual update of the plants. perhaps a daily image



### Local Storage

Data is stored via volume on the computer running the docker container.

view the data by doing the following in a terminal:

Use psql inside the db container

```bash
docker compose exec timescaledb psql -U postgres -d app
```

run up some sql commands

```sql
SELECT * FROM mqtt_summary ORDER BY ts DESC LIMIT 20;
```

## Networking Notes

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


