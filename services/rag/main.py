import os
from pinecone import ServerlessSpec
from pinecone.grpc import PineconeGRPC as Pinecone
from dotenv import load_dotenv

from data.helpers import listRawData


def main():
    rd = listRawData()
    print(rd)
    # pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    # if not pc.has_index(index_name):
    #     pc.create_index(
    #         name=hybindex,
    #         vector_type="dense",
    #         dimension=1024,
    #         metric="dotproduct",
    #         spec=ServerlessSpec(
    #             cloud="gcp",
    #             region="iowa"
    #         )
    #     )

if __name__ == "__main__":
    main()