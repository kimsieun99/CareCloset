/**
 * [리팩토링 전] 초기 구현(v1) - 검색어 + 계절 필터
 *
 * 동작은 하지만 다음과 같은 문제가 있었다.
 *  1) 계절 조건 검사 코드가 두 곳에 중복되어 있다.
 *  2) if/else가 3~4단계로 중첩되어 읽기 어렵다.
 *  3) 검색어의 앞뒤 공백, 영문 대소문자를 처리하지 않는다.
 *  4) list가 배열이 아니거나 seasons가 없는 데이터가 오면 예외가 발생한다.
 */
function filterClothes(list, options) {
  var query = options.query;
  var season = options.season;
  var result = [];

  for (var i = 0; i < list.length; i++) {
    var item = list[i];

    if (query == '' || query == null) {
      if (season == '' || season == null) {
        result.push(item);
      } else {
        if (item.seasons.indexOf(season) != -1) {
          result.push(item);
        }
      }
    } else {
      if (item.name.indexOf(query) != -1) {
        if (season == '' || season == null) {
          result.push(item);
        } else {
          if (item.seasons.indexOf(season) != -1) {
            result.push(item);
          }
        }
      }
    }
  }

  return result;
}

module.exports = { filterClothes };
