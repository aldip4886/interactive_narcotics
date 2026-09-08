from PIL import Image
import numpy as np
import os

uploaded_img_path = r'C:\Users\aldip\.gemini\antigravity\brain\6357d122-6f34-4c86-9625-dd21d57ba2ce\.user_uploaded\media_1788841613488.jpg'
out_dir = r'd:\OneDrive - Kemenkeu\Projects\elearning_narkotika\interactive_narcotics\interactive_narcotics\src\assets\body_views'
os.makedirs(out_dir, exist_ok=True)

img = Image.open(uploaded_img_path).convert('RGBA')

# Define bounding boxes for the 4 figures in original image
# [left, top, right, bottom]
figures_crop_boxes = [
    [100, 5, 340, 565],  # 0° Front
    [345, 5, 485, 565],  # 90° Right
    [500, 5, 740, 565],  # 180° Back
    [755, 5, 900, 565]   # 270° Left
]

names = ["front", "right", "back", "left"]
target_w, target_h = 260, 560

for i, crop_box in enumerate(figures_crop_boxes):
    crop = img.crop(crop_box)
    
    data = np.array(crop)
    r = data[:, :, 0].astype(float)
    g = data[:, :, 1].astype(float)
    b = data[:, :, 2].astype(float)
    
    # Distance from white background
    max_diff = np.maximum(255.0 - r, np.maximum(255.0 - g, 255.0 - b))
    
    # Make background smooth transparent (threshold 15)
    alpha = np.where(max_diff < 15.0, 0, np.clip((max_diff - 15.0) * 16.0, 0, 255)).astype(np.uint8)
    data[:, :, 3] = alpha
    
    res = Image.fromarray(data)
    
    # Get exact bounding box of the body
    bbox = res.getbbox()
    if bbox:
        body = res.crop(bbox)
        bw, bh = body.size
        
        # Consistent vertical height: 505 px (leaving 25px top, 30px bottom)
        target_bh = 505
        scale = target_bh / float(bh)
        new_w = int(bw * scale)
        new_h = int(bh * scale)
        
        body_resized = body.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
        # Center horizontally at 50%
        offset_x = (target_w - new_w) // 2
        # Place head top around y=25
        offset_y = 25
        
        canvas.paste(body_resized, (offset_x, offset_y), body_resized)
        
        out_path = os.path.join(out_dir, f'body_view_{i}_{names[i]}.png')
        canvas.save(out_path)
        print(f'Saved {out_path}: size {canvas.size}, body placed at x={offset_x}, y={offset_y}, w={new_w}, h={new_h}')
