import asyncio

def actually_not_async(fn):
    def res(*args, **kwargs):
        return asyncio.run(fn(*args, **kwargs))

    return res

