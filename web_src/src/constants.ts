import { NodeStruct } from "./util/graph";

export const DEFAULT: NodeStruct[] = [
  {
    id: 1,
    pos: [0, 0],
    dims: [1, 1],
    text:
      "Started his hearted any civilly. So me by marianne admitted speaking. Men bred fine call ask. Cease one miles truth day above seven. Suspicion sportsmen provision suffering mrs saw engrossed something. Snug soon he on plan in be dine some.\n" +
      "Greatest properly off ham exercise all. Unsatiable invitation its possession nor off. All difficulty estimating unreserved increasing the solicitude. Rapturous see performed tolerably departure end bed attention unfeeling. On unpleasing principles alteration of. Be at performed preferred determine collected. Him nay acuteness discourse listening estimable our law. Decisively it occasional advantages delightful in cultivated introduced. Like law mean form are sang loud lady put.",
    factualDependencies: [],
  },
  {
    id: 2,
    pos: [1, 0],
    dims: [0.5, 0.5],
    text: "Node 2",
    factualDependencies: [1],
  },
  {
    id: 3,
    pos: [1.5, 1],
    dims: [0.5, 0.5],
    text: "Node 3",
    factualDependencies: [1],
  },
  {
    id: 4,
    pos: [-1.5, 0],
    dims: [1, 1],
    text: "Node 4",
    factualDependencies: [],
  },
]
