from tools import search


class BaseAgent:
    def close(self) -> None:
        return None


class Agent(BaseAgent):
    def __init__(self) -> None:
        self._count = 0

    def execute(self, task: dict) -> str:
        self._count += 1
        return search(task)

    async def plan(self, task: dict) -> dict:
        return task
