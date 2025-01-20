import json

def extract_spuId_title(file_path, output_path):
    results = []
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            try:
                # 尝试解析每一行的JSON对象
                data = json.loads(line.strip())
                # 提取spuId和title
                spuId = data.get('spuId')
                title = data.get('title')
                if spuId and title:
                    results.append({'spuId': spuId, 'title': title})
            except json.JSONDecodeError:
                # 如果解析失败，跳过该行
                continue

    # 将结果写入到一个新的JSON文件中
    with open(output_path, 'w', encoding='utf-8') as outfile:
        json.dump(results, outfile, ensure_ascii=False, indent=4)

# 使用文件的实际路径
extract_spuId_title(
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/src/utils/spudb1119.json',
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/src/utils/spuId_title.json'
)