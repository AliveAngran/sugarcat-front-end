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

# 使用相对路径
import os

# 获取脚本所在目录的父目录（项目根目录）
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

extract_spuId_title(
    os.path.join(project_root, 'src/utils/spudb1119.json'),
    os.path.join(project_root, 'src/utils/spuId_title.json')
)