
export type Vec2 = [number, number]

export function add(a: Vec2, b: Vec2): Vec2 {
	return [a[0] + b[0], a[1] + b[1]]
}

export function scale(s: number, v: Vec2): Vec2 {
	return [v[0] * s, v[1] * s]
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
	return [a[0] - b[0], a[1] - b[1]]
}


export function avg(p1: Vec2, p2: Vec2): Vec2 {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}
