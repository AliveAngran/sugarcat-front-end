import json

def merge_json_files(file1, file2, output_file):
    # 读取第一个JSON文件
    with open(file1, 'r', encoding='utf-8') as f:
        data1 = json.load(f)
    
    # 读取第二个JSON文件
    with open(file2, 'r', encoding='utf-8') as f:
        data2 = json.load(f)
    
    # 创建一个字典来存储合并结果，优先使用第二个文件的数据
    merged_data = {item['spuId']: item for item in data2}  # 使用字典中的spuId
    
    # 添加第一个文件中的数据，如果spuId不在第二个文件中
    for item in data1:
        spuId = item['spuId']  # 使用字典中的spuId
        if spuId not in merged_data:
            merged_data[spuId] = item
    
    # 将合并结果转换为列表
    final_result = list(merged_data.values())
    
    # 将结果写入到一个新的JSON文件中
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=4)

# 使用文件的实际路径
merge_json_files(
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/scripts/spuId_title.json',
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/scripts/extracted_spuId_title.json',
    '/Users/arz/Downloads/PanDownload/微信小程序开发/小程序管理前端/sugarcat-front-end/scripts/final.json'
)
