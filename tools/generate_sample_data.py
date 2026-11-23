"""CareCloset 테스트·시연용 샘플 데이터 생성기.

외부 패키지 없이 Python 표준 라이브러리만 사용한다. (Python 3.8 이상)

사용법:
    python tools/generate_sample_data.py                       # 30벌 생성 -> sample/sample_clothes.json
    python tools/generate_sample_data.py --count 100 --output sample/sample_100.json

생성된 JSON은 앱의 "데이터 가져오기" 버튼으로 불러올 수 있다.
같은 --seed 를 주면 항상 같은 데이터가 만들어진다.
"""
import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

COLORS = ["검은색", "흰색", "크림색", "하늘색", "베이지", "카키", "네이비", "회색", "연분홍"]

# 종류 -> (재질, 계절, 세탁 방법, 물 온도, 건조 방법, 주의사항)
KINDS = {
    "니트": ("울 혼방", ["가을", "겨울"], "손세탁", "30℃ 이하", "눕혀서 건조", "비틀어 짜지 말고 눕혀서 말리기. 중성세제 사용."),
    "면 셔츠": ("면 100%", ["봄", "여름", "가을"], "세탁기", "40℃ 이하", "그늘에서 자연 건조", "표백제 사용 금지. 다림질은 중온."),
    "청바지": ("데님", ["봄", "가을", "겨울"], "세탁기", "30℃ 이하", "그늘에서 자연 건조", "뒤집어서 단독 세탁(물빠짐 주의)."),
    "맨투맨": ("면 혼방", ["봄", "가을"], "세탁기", "40℃ 이하", "그늘에서 자연 건조", "뒤집어서 세탁하면 보풀이 줄어든다."),
    "후드집업": ("기모 폴리", ["가을", "겨울"], "세탁기", "30℃ 이하", "그늘에서 자연 건조", "지퍼를 잠그고 세탁망 사용."),
    "린넨 팬츠": ("린넨", ["여름"], "손세탁", "30℃ 이하", "그늘에서 자연 건조", "구김이 잘 가므로 털어서 널기."),
    "반팔 티셔츠": ("면 100%", ["여름"], "세탁기", "40℃ 이하", "건조기 사용 가능", "프린트 부분은 뒤집어서 세탁."),
    "패딩": ("나일론/오리털", ["겨울"], "드라이클리닝", "", "그늘에서 자연 건조", "집에서 세탁 시 전용 세제 사용 후 공 넣고 건조."),
    "원피스": ("레이온", ["봄", "여름"], "손세탁", "찬물", "눕혀서 건조", "열에 약하므로 건조기 사용 금지."),
    "코트": ("울 캐시미어", ["가을", "겨울"], "드라이클리닝", "", "그늘에서 자연 건조", "보관 시 통기성 있는 커버 사용."),
    "기능성 레깅스": ("폴리에스터/스판", ["봄", "여름", "가을"], "세탁기", "30℃ 이하", "그늘에서 자연 건조", "섬유유연제 사용 금지(기능 저하)."),
}


def build_items(count: int, seed: int) -> list:
    rng = random.Random(seed)
    base = datetime(2026, 1, 1, 9, 0, 0)
    items = []
    for index in range(count):
        kind = rng.choice(list(KINDS))
        material, seasons, washing, water, drying, notes = KINDS[kind]
        created = (base + timedelta(hours=index)).isoformat() + "Z"
        items.append(
            {
                "id": f"sample-{index + 1:03d}",
                "name": f"{rng.choice(COLORS)} {kind}",
                "material": material,
                "seasons": seasons,
                "clothingImage": None,
                "labelImage": None,
                "washingMethod": washing,
                "waterTemperature": water,
                "dryingMethod": drying,
                "notes": notes,
                "createdAt": created,
                "updatedAt": created,
            }
        )
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="CareCloset 샘플 데이터 생성기")
    parser.add_argument("--count", type=int, default=30, help="생성할 의류 개수 (기본 30)")
    parser.add_argument("--seed", type=int, default=2026, help="난수 시드 (기본 2026)")
    parser.add_argument("--output", default="sample/sample_clothes.json", help="저장 경로")
    args = parser.parse_args()

    if args.count < 1:
        parser.error("--count 는 1 이상이어야 합니다.")

    data = {"app": "CareCloset", "version": 1, "exportedAt": "2026-01-01T00:00:00Z", "items": build_items(args.count, args.seed)}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{args.count}벌의 샘플 데이터를 {output} 에 저장했습니다.")


if __name__ == "__main__":
    main()
