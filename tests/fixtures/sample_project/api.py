from agent import Agent


def handle_request(data: dict) -> str:
    return Agent().execute(data)
