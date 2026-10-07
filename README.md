# 1. 配置Git用户名和邮箱（只需要第一次电脑上执行一次）
git config --global user.name "你的Gitee用户名"
git config --global user.email "你的Gitee绑定邮箱"

# 2. 初始化本地git仓库（在项目文件夹执行）
git init

# 3. 将当前所有文件加入暂存区
git add .

# 4. 本地提交，备注写first commit
git commit -m "first commit"

# 5. 关联远程Gitee仓库，粘贴你复制的仓库地址
git remote add origin https://gitee.com/用户名/仓库名.git

# 6. 第一次推送，-u 绑定本地与远程分支（重点！）
git push -u origin master
# 如果报错提示master不存在，换成 main
# git push -u origin main
